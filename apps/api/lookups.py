"""Real page lookups for @researcher, through the same `fetch` MCP server that
.kiro/settings/mcp.json configures for the IDE.

Only URLs that already appear in the thread are ever fetched (the model never picks a URL), and
every URL must resolve to a public address, so a pasted http://localhost link can't be used to
probe the machine running the API. Fetched text is untrusted data, not instructions.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import os
import socket
import threading
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

log = logging.getLogger("rewave.lookups")

DEFAULT_COMMAND = ("uvx", ["mcp-server-fetch"])
MCP_CONFIG = Path(os.getenv("MCP_CONFIG", Path(__file__).resolve().parents[2] / ".kiro" / "settings" / "mcp.json"))


class PageLookupError(Exception):
    """A lookup failed. The message is safe to show to the user."""


def is_public_url(url: str, resolve: Callable[[str], list[str]] | None = None) -> bool:
    """True for http(s) URLs whose host resolves only to globally routable addresses."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    host = parsed.hostname
    if resolve is None:
        def resolve(h: str) -> list[str]:
            return [info[4][0] for info in socket.getaddrinfo(h, None)]
    try:
        addresses = resolve(host)
    except OSError:
        return False
    if not addresses:
        return False
    for raw in addresses:
        try:
            if not ipaddress.ip_address(raw.split("%")[0]).is_global:
                return False
        except ValueError:
            return False
    return True


def server_command(config_path: Path = MCP_CONFIG) -> tuple[str, list[str]]:
    """Command for the `fetch` server from mcp.json, or the default (`uvx mcp-server-fetch`)."""
    try:
        server = json.loads(config_path.read_text(encoding="utf-8"))["mcpServers"]["fetch"]
        if not server.get("disabled"):
            return str(server["command"]), [str(a) for a in server.get("args", [])]
    except (OSError, KeyError, TypeError, ValueError):
        pass
    return DEFAULT_COMMAND


class McpFetcher:
    """Blocking facade over a long-lived MCP `fetch` session.

    The session lives on its own event-loop thread so FastAPI's sync endpoints can call `fetch()`
    directly, and the server process is started once and reused across requests.
    """

    def __init__(self, command: tuple[str, list[str]] | None = None, timeout: float = 45.0) -> None:
        self._command = command
        self._timeout = timeout
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._stack: AsyncExitStack | None = None
        self._session = None
        self._start_lock = threading.Lock()

    def _ensure_loop(self) -> asyncio.AbstractEventLoop:
        with self._start_lock:
            if self._loop is None:
                loop = asyncio.new_event_loop()
                thread = threading.Thread(target=loop.run_forever, name="mcp-fetch", daemon=True)
                thread.start()
                self._loop, self._thread = loop, thread
            return self._loop

    async def _open(self):
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        command, args = self._command or server_command()
        stack = AsyncExitStack()
        try:
            read, write = await stack.enter_async_context(stdio_client(StdioServerParameters(command=command, args=args)))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
        except BaseException:
            await stack.aclose()
            raise
        self._stack, self._session = stack, session
        return session

    async def _fetch(self, url: str, max_chars: int) -> str:
        session = self._session or await self._open()
        result = await session.call_tool("fetch", {"url": url, "max_length": max_chars})
        text = "\n".join(getattr(part, "text", "") for part in result.content).strip()
        if getattr(result, "isError", False):
            raise PageLookupError(text[:200] or "The page could not be fetched.")
        return text

    async def _reset(self) -> None:
        stack, self._stack, self._session = self._stack, None, None
        if stack is not None:
            try:
                await stack.aclose()
            except BaseException:  # the server may already be gone
                log.debug("error closing MCP session", exc_info=True)

    def fetch(self, url: str, max_chars: int = 6000) -> str:
        loop = self._ensure_loop()
        future = asyncio.run_coroutine_threadsafe(self._fetch(url, max_chars), loop)
        try:
            return future.result(timeout=self._timeout)
        except PageLookupError:
            raise
        except TimeoutError as e:
            future.cancel()
            asyncio.run_coroutine_threadsafe(self._reset(), loop)
            raise PageLookupError("The page took too long to load.") from e
        except Exception as e:  # server failed to start or crashed: drop the session so the next call retries
            log.warning("MCP fetch failed: %s", e)
            asyncio.run_coroutine_threadsafe(self._reset(), loop).result(timeout=10)
            raise PageLookupError("Page lookups are unavailable right now.") from e

    def warm_up(self) -> None:
        """Start the server and run one fetch in the background, so a user's first lookup is fast.

        The first run of mcp-server-fetch installs its readability dependencies (about 20 s).
        """

        def run() -> None:
            try:
                self.fetch("https://example.com", 200)
            except PageLookupError:
                log.info("MCP fetch warm-up failed; lookups will retry on first use")

        threading.Thread(target=run, name="mcp-warmup", daemon=True).start()

    def close(self) -> None:
        if self._loop is None:
            return
        try:
            asyncio.run_coroutine_threadsafe(self._reset(), self._loop).result(timeout=10)
        except Exception:
            log.debug("error shutting down MCP fetcher", exc_info=True)
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._loop = None
