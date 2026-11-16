"""Rate limit and cost guard for the public demo (spec 03 task 6).

Everything is in memory and per process: fine for a single-instance demo. Behind a shared proxy
(including the Vite dev proxy) every caller shares one client address, so the per-client limit then
acts as a global one.
"""

from __future__ import annotations

import os
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Callable, Mapping


def _int(env: Mapping[str, str], name: str, default: int) -> int:
    try:
        return max(0, int(env.get(name, default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Limits:
    per_minute: int = 10  # agent calls per client per rolling minute
    per_day: int = 300  # agent calls across all clients per UTC day (the spend ceiling)
    max_blips: int = 200  # blips accepted in one request
    max_chars: int = 40_000  # transcript characters accepted in one request
    max_fetches: int = 3  # pages @researcher may read per call
    page_chars: int = 6_000  # characters kept from each page
    lookups: bool = True  # @researcher page lookups through the MCP fetch server

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "Limits":
        env = os.environ if env is None else env
        d = cls()
        return cls(
            per_minute=_int(env, "AGENT_RATE_PER_MIN", d.per_minute),
            per_day=_int(env, "AGENT_DAILY_LIMIT", d.per_day),
            max_blips=_int(env, "AGENT_MAX_BLIPS", d.max_blips),
            max_chars=_int(env, "AGENT_MAX_TRANSCRIPT_CHARS", d.max_chars),
            max_fetches=_int(env, "AGENT_MAX_FETCHES", d.max_fetches),
            page_chars=_int(env, "AGENT_PAGE_CHARS", d.page_chars),
            lookups=env.get("AGENT_LOOKUPS", "on").strip().lower() not in ("off", "0", "false", "no"),
        )


class RateLimited(Exception):
    def __init__(self, message: str, retry_after: int) -> None:
        super().__init__(message)
        self.message = message
        self.retry_after = max(1, int(retry_after))


class CallGuard:
    """Sliding-window per-client limit plus a global daily call budget. Thread-safe."""

    MAX_CLIENTS = 5000

    def __init__(self, limits: Limits, clock: Callable[[], float] = time.time) -> None:
        self.limits = limits
        self._clock = clock
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = {}
        self._day = self._day_of(clock())
        self._day_count = 0

    @staticmethod
    def _day_of(now: float) -> int:
        return int(now // 86400)

    def check(self, client_id: str) -> None:
        """Count one agent call for `client_id`, or raise RateLimited."""
        now = self._clock()
        with self._lock:
            day = self._day_of(now)
            if day != self._day:
                self._day, self._day_count = day, 0
            if self.limits.per_day and self._day_count >= self.limits.per_day:
                raise RateLimited(
                    "The daily agent budget for this demo is used up. Try again tomorrow.",
                    (day + 1) * 86400 - now,
                )
            if self.limits.per_minute:
                hits = self._hits.setdefault(client_id, deque())
                while hits and hits[0] <= now - 60:
                    hits.popleft()
                if len(hits) >= self.limits.per_minute:
                    raise RateLimited(
                        f"Too many agent requests. Wait a moment (limit: {self.limits.per_minute} per minute).",
                        hits[0] + 60 - now,
                    )
                hits.append(now)
                if len(self._hits) > self.MAX_CLIENTS:
                    self._prune(now)
            self._day_count += 1

    def _prune(self, now: float) -> None:
        for key in [k for k, h in self._hits.items() if not h or h[-1] <= now - 60]:
            del self._hits[key]


def check_size(limits: Limits, blip_count: int, transcript_chars: int) -> str | None:
    """A message if the request is too large for one agent call, else None."""
    if limits.max_blips and blip_count > limits.max_blips:
        return f"This wave has {blip_count} blips; agents read at most {limits.max_blips} at a time."
    if limits.max_chars and transcript_chars > limits.max_chars:
        return f"This thread is too long for one agent call (limit {limits.max_chars} characters)."
    return None
