import json
import mimetypes
import os
import re
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Iterator, Literal, NamedTuple
from urllib.parse import quote, urlparse

import groq
from groq import Groq
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from agents import AGENTS, CARD_FORMAT, NARRATOR_PROMPT, RESEARCHER_LOOKUP_NOTE, SPEC_EXPORT_PROMPT
from guards import CallGuard, Limits, RateLimited, check_size
from lookups import McpFetcher, PageLookupError, is_public_url
from narration import validate_captions
from spec_export import clean as _clean_spec_text, is_thin, thin_spec, validate_spec

load_dotenv()

_fetcher: McpFetcher | None = None


@asynccontextmanager
async def _lifespan(_: FastAPI):
    if LIMITS.lookups and LIMITS.max_fetches:
        get_fetcher().warm_up()
    yield
    if _fetcher is not None:
        _fetcher.close()


app = FastAPI(title="Rewave agents API", lifespan=_lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
# gpt-oss is a reasoning model: reasoning tokens count against the completion budget, so keep it
# generous, and keep the effort low (these are short, structured answers).
REASONING_EFFORT = os.getenv("GROQ_REASONING_EFFORT", "low")
MAX_COMPLETION_TOKENS = 2000
_client: Groq | None = None


def client() -> Groq:
    global _client
    if _client is None:
        if not os.getenv("GROQ_API_KEY"):
            raise HTTPException(500, "GROQ_API_KEY is not set. Copy .env.example to .env.")
        _client = Groq()
    return _client


class BlipIn(BaseModel):
    id: str
    parentId: str | None = None
    author: str
    text: str


class AgentRequest(BaseModel):
    blips: list[BlipIn]
    # "3 agree, 1 disagree, 2 unsure" — the wave's stance summary, for the scribe.
    stances: str | None = None


class AgentResponse(BaseModel):
    text: str
    sources: list[str]  # blip ids cited by the agent
    # Structured card for the web app; None if the model didn't return valid JSON.
    card: dict[str, Any] | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL}


CITE_RE = re.compile(r"\[b:([^\]]+)\]")
URL_RE = re.compile(r"https?://[^\s<>\]\)\"']+")


def _drop_unknown_citations(text: str, known: set[str]) -> str:
    """Citations that do not match a real blip id are dropped (agent-behavior rule 2)."""
    return CITE_RE.sub(lambda m: m.group(0) if m.group(1) in known else "", text).strip()


def _first_json_object(text: str) -> dict[str, Any] | None:
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def _str(value: Any, limit: int = 2000) -> str:
    return value.strip()[:limit] if isinstance(value, str) else ""


def _str_list(value: Any, limit: int = 12) -> list[str]:
    if not isinstance(value, list):
        return []
    return [s for s in (_str(v, 600) for v in value[:limit]) if s]


def _build_card(agent: str, raw: dict[str, Any], known: set[str], thread_urls: set[str]) -> dict[str, Any] | None:
    clean = lambda s: _drop_unknown_citations(s, known)  # noqa: E731
    if agent == "scribe":
        summary = clean(_str(raw.get("summary")))
        decisions = [clean(d) for d in _str_list(raw.get("decisions"))]
        return {"agent": "scribe", "summary": summary, "decisions": [d for d in decisions if d]} if summary else None
    if agent == "skeptic":
        counterpoint = clean(_str(raw.get("counterpoint")))
        return {"agent": "skeptic", "counterpoint": counterpoint} if counterpoint else None
    if agent == "researcher":
        sources = []
        for s in raw.get("sources") or []:
            if not isinstance(s, dict):
                continue
            url = _str(s.get("url"), 500)
            # No web access yet: a source is only kept if its URL really appears in the thread.
            if url not in thread_urls:
                continue
            domain = (urlparse(url).hostname or url).removeprefix("www.")
            sources.append({"title": _str(s.get("title"), 200) or domain, "url": url, "domain": domain, "quote": _str(s.get("quote"), 400)})
        return {
            "agent": "researcher",
            "summary": clean(_str(raw.get("summary"))),
            "sources": sources[:8],
            "lookups": [clean(x) for x in _str_list(raw.get("lookups"))],
        }
    return None


def _card_to_text(card: dict[str, Any]) -> str:
    """Plain-text version of a card, stored as the blip text (search, list snippet, fallback)."""
    if card["agent"] == "scribe":
        lines = [card["summary"]] + [f"- {d}" for d in card["decisions"]]
    elif card["agent"] == "skeptic":
        lines = [card["counterpoint"]]
    else:
        lines = [card.get("summary") or "Sources:"] + [f"- {s['title']} ({s['url']})" for s in card["sources"]]
        lines += [f"- Look up: {x}" for x in card.get("lookups", [])]
    return "\n".join(l for l in lines if l)


LIMITS = Limits.from_env()
GUARD = CallGuard(LIMITS)


def get_fetcher() -> McpFetcher:
    global _fetcher
    if _fetcher is None:
        _fetcher = McpFetcher()
    return _fetcher


class Prepared(NamedTuple):
    system: str
    transcript: str
    known: set[str]
    urls: list[str]  # URLs in the thread, in order of first appearance


def _prepare(agent: str, req: AgentRequest, request: Request) -> tuple[Prepared, Groq]:
    """Validate one agent call and charge it against the rate limit and daily budget."""
    system = AGENTS.get(agent)
    if system is None:
        raise HTTPException(404, f"Unknown agent '{agent}'. Available: {', '.join(AGENTS)}")
    if not req.blips:
        raise HTTPException(400, "The wave has no blips yet.")
    transcript = "\n".join(
        f"[b:{b.id}] {b.author}{' (reply to ' + b.parentId + ')' if b.parentId else ''}: {b.text}"
        for b in req.blips
    )
    if req.stances:
        transcript += f"\n\nStance summary for the whole wave: {req.stances}"
    too_big = check_size(LIMITS, len(req.blips), len(transcript))
    if too_big:
        raise HTTPException(413, too_big)
    model_client = client()  # fails with a clear message before any budget is spent
    try:
        GUARD.check(request.client.host if request.client else "unknown")
    except RateLimited as e:
        raise HTTPException(429, e.message, headers={"Retry-After": str(e.retry_after)}) from e
    prepared = Prepared(
        system=f"{system}\n\n{CARD_FORMAT.get(agent, '')}",
        transcript=transcript,
        known={b.id for b in req.blips},
        urls=list(dict.fromkeys(URL_RE.findall(transcript))),
    )
    return prepared, model_client


def _page_blocks(pages: list[tuple[str, str]], notes: list[str]) -> str:
    blocks = [
        # A page must not be able to close its own block and pose as thread text.
        f'<page url="{url}">\n{text.replace("</page", "<\\/page")}\n</page>'
        for url, text in pages
    ]
    return "\n".join(blocks + notes)


def _agent_events(agent: str, p: Prepared, model_client: Groq) -> Iterator[dict[str, Any]]:
    """The one agent run. Yields status / delta events, then a single done or error event."""
    system = p.system
    user = f"Wave thread:\n{p.transcript}"
    if agent == "researcher" and LIMITS.lookups and LIMITS.max_fetches and p.urls:
        pages: list[tuple[str, str]] = []
        notes: list[str] = []
        for url in p.urls[: LIMITS.max_fetches]:
            domain = (urlparse(url).hostname or url).removeprefix("www.")
            yield {"type": "status", "message": f"Reading {domain}\u2026"}
            if not is_public_url(url):
                notes.append(f"[{url} was skipped: not a public web address]")
                continue
            try:
                pages.append((url, get_fetcher().fetch(url, LIMITS.page_chars)))
            except PageLookupError as e:
                notes.append(f"[{url} could not be fetched: {e}]")
        system += f"\n\n{RESEARCHER_LOOKUP_NOTE}"
        user += f"\n\nFetched pages:\n{_page_blocks(pages, notes)}"
    yield {"type": "status", "message": "Writing\u2026"}
    chunks: list[str] = []
    try:
        stream = model_client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_completion_tokens=MAX_COMPLETION_TOKENS,
            reasoning_effort=REASONING_EFFORT,
            stream=True,
        )
        for chunk in stream:
            piece = chunk.choices[0].delta.content if chunk.choices else None
            if piece:  # reasoning arrives in a separate field and is never shown
                chunks.append(piece)
                yield {"type": "delta", "text": piece}
    except groq.APIStatusError as e:
        busy = e.status_code == 429
        message = "The model is busy." if busy else f"The model request failed ({e.status_code})."
        yield {"type": "error", "status": 429 if busy else 502, "message": message}
        return
    except groq.APIError:
        yield {"type": "error", "status": 502, "message": "The model could not be reached."}
        return
    raw_text = "".join(chunks)
    transcript_urls = set(p.urls)
    parsed = _first_json_object(raw_text)
    card = _build_card(agent, parsed, p.known, transcript_urls) if parsed else None
    text = _card_to_text(card) if card else _drop_unknown_citations(raw_text, p.known)
    sources = [s for s in dict.fromkeys(CITE_RE.findall(text)) if s in p.known]
    yield {"type": "done", "text": text, "sources": sources, "card": card}


class NarrateRequest(BaseModel):
    blips: list[BlipIn]
    decision: str


class CaptionOut(BaseModel):
    atBlipId: str
    text: str


class NarrateResponse(BaseModel):
    captions: list[CaptionOut]


NARRATE_BLIP_CHARS = 600
NARRATE_DECISION_CHARS = 600


def _flat(text: str, limit: int) -> str:
    """One line, so a blip cannot fake a `[b:id]` line of its own; capped to keep the call cheap."""
    return " ".join(text.split())[:limit]


def _narration_messages(req: NarrateRequest, decision: str) -> list[dict[str, str]]:
    lines = [
        f"[b:{b.id}] {_flat(b.author, 60)}{' (reply to ' + b.parentId + ')' if b.parentId else ''}: {_flat(b.text, NARRATE_BLIP_CHARS)}"
        for b in req.blips
    ]
    user = "Thread blips, in order:\n" + "\n".join(lines) + f"\n\nDecision: {_flat(decision, NARRATE_DECISION_CHARS)}"
    return [{"role": "system", "content": NARRATOR_PROMPT}, {"role": "user", "content": user}]


def _narrate(model_client: Groq, messages: list[dict[str, str]], order: list[str]) -> list[dict[str, str]]:
    """One non-streaming model call; returns validated captions (possibly empty)."""
    try:
        res = model_client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_completion_tokens=MAX_COMPLETION_TOKENS,
            reasoning_effort=REASONING_EFFORT,
            stream=False,
        )
    except groq.APIStatusError as e:
        if e.status_code == 429:
            raise HTTPException(429, "The model is busy.") from e
        raise HTTPException(502, f"The model request failed ({e.status_code}).") from e
    except groq.APIError as e:
        raise HTTPException(502, "The model could not be reached.") from e
    content = res.choices[0].message.content if res.choices else None
    parsed = _first_json_object(content or "")
    return validate_captions(parsed, order)


# Registered before "/agents/{agent}" so the name "narrate" is not read as an agent.
@app.post("/agents/narrate", response_model=NarrateResponse)
def narrate(req: NarrateRequest, request: Request) -> NarrateResponse:
    """Short captions for a decision replay. Runs only when a human clicks Replay
    (agent-behavior rule 6). Validation failures cost no budget; a real call is charged like any agent run."""
    decision = req.decision.strip()
    if not req.blips:
        raise HTTPException(400, "The replay has no blips to narrate.")
    if not decision:
        raise HTTPException(400, "The decision has no text to narrate.")
    messages = _narration_messages(req, decision)
    too_big = check_size(LIMITS, len(req.blips), len(messages[1]["content"]))
    if too_big:
        raise HTTPException(413, too_big)
    model_client = client()  # fails with a clear message before any budget is spent
    try:
        GUARD.check(request.client.host if request.client else "unknown")
    except RateLimited as e:
        raise HTTPException(429, e.message, headers={"Retry-After": str(e.retry_after)}) from e
    captions = _narrate(model_client, messages, [b.id for b in req.blips])
    if not captions:
        raise HTTPException(502, "The narrator returned no usable captions.")
    return NarrateResponse(captions=[CaptionOut(**c) for c in captions])


class ExportBlipIn(BlipIn):
    kind: Literal["human", "agent"] = "human"
class SpecExportRequest(BaseModel):
    decision: str
    sources: list[ExportBlipIn] = []  # the blips the decision cites
    context: list[ExportBlipIn] = []  # nearby thread; may repeat sources
SPEC_MAX_COMPLETION_TOKENS = 4000  # the spec JSON is long, and reasoning tokens count against the budget
def _spec_messages(req: SpecExportRequest, decision: str) -> tuple[list[dict[str, str]], dict[str, str]]:
    """The model prompt, and a map of every input blip id to its author (the only valid evidence ids)."""
    def line(b: ExportBlipIn) -> str:
        reply = f" (reply to {b.parentId})" if b.parentId else ""
        return f"[b:{b.id}] {_flat(b.author, 60)}{reply}: {_flat(b.text, NARRATE_BLIP_CHARS)}"
    author_of: dict[str, str] = {}
    for b in [*req.sources, *req.context]:
        author_of.setdefault(b.id, _flat(b.author, 60))
    source_ids = {b.id for b in req.sources}
    context = [b for b in req.context if b.id not in source_ids]
    user = (
        f"Decision: {_flat(decision, NARRATE_DECISION_CHARS)}\n\n"
        "SOURCES (blips that support the decision):\n" + "\n".join(line(b) for b in req.sources)
        + "\n\nCONTEXT (nearby blips):\n" + "\n".join(line(b) for b in context)
    )
    return [{"role": "system", "content": SPEC_EXPORT_PROMPT}, {"role": "user", "content": user}], author_of
def _generate_spec(model_client: Groq, messages: list[dict[str, str]]) -> dict[str, Any] | None:
    try:
        res = model_client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_completion_tokens=SPEC_MAX_COMPLETION_TOKENS,
            reasoning_effort=REASONING_EFFORT,
            stream=False,
        )
    except groq.APIStatusError as e:
        if e.status_code == 429:
            raise HTTPException(429, "The model is busy.") from e
        raise HTTPException(502, f"The model request failed ({e.status_code}).") from e
    except groq.APIError as e:
        raise HTTPException(502, "The model could not be reached.") from e
    content = res.choices[0].message.content if res.choices else None
    return _first_json_object(content or "")
@app.post("/export/spec")
def export_spec(req: SpecExportRequest, request: Request) -> dict[str, Any]:
    """Draft a Kiro spec from a decision and its thread. Runs only when a human clicks Export
    (agent-behavior rule 6). Validation failures and thin threads cost no budget."""
    decision = req.decision.strip()
    if not decision:
        raise HTTPException(400, "The decision has no text to export.")
    if not req.sources and not req.context:
        raise HTTPException(400, "There are no blips to export.")
    messages, author_of = _spec_messages(req, decision)
    too_big = check_size(LIMITS, len(author_of), len(messages[1]["content"]))
    if too_big:
        raise HTTPException(413, too_big)
    if is_thin((b.id, b.kind) for b in req.sources):
        return thin_spec(decision)
    model_client = client()  # fails with a clear message before any budget is spent
    try:
        GUARD.check(request.client.host if request.client else "unknown")
    except RateLimited as e:
        raise HTTPException(429, e.message, headers={"Retry-After": str(e.retry_after)}) from e
    spec = validate_spec(_generate_spec(model_client, messages), author_of)
    if spec is None:
        raise HTTPException(502, "The model returned no usable spec.")
    # The decision is the user's own text, so it is safe to fall back to it.
    spec["design"]["decision"] = spec["design"]["decision"] or _clean_spec_text(decision, 600)
    return spec
@app.post("/agents/{agent}", response_model=AgentResponse)
def run_agent(agent: str, req: AgentRequest, request: Request) -> AgentResponse:
    prepared, model_client = _prepare(agent, req, request)
    for event in _agent_events(agent, prepared, model_client):
        if event["type"] == "error":
            raise HTTPException(event["status"], event["message"])
        if event["type"] == "done":
            return AgentResponse(text=event["text"], sources=event["sources"], card=event["card"])
    raise HTTPException(502, "The agent returned nothing.")


def _sse(events: Iterator[dict[str, Any]]) -> Iterator[str]:
    for event in events:
        yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"


@app.post("/agents/{agent}/stream")
def stream_agent(agent: str, req: AgentRequest, request: Request) -> StreamingResponse:
    """Server-Sent Events: `status` and `delta` while working, then `done` (same body as the
    non-streaming endpoint) or `error`. Validation and rate-limit failures are ordinary HTTP errors."""
    prepared, model_client = _prepare(agent, req, request)
    return StreamingResponse(
        _sse(_agent_events(agent, prepared, model_client)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# ---------------------------------------------------------------------------
# File uploads for blip attachments.
# Files live on local disk under UPLOAD_DIR. The URL carries a random 128-bit id, matching the
# app's capability model (anyone with the link can read it; nothing lists uploads).
# ---------------------------------------------------------------------------

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", Path(__file__).parent / "uploads")).resolve()
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # keep in sync with MAX_FILE_BYTES in apps/web/src/wave/attachments.ts
ALLOWED_EXT = {
    # images / screenshots / sketches
    "png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg",
    # video
    "mp4", "webm", "mov", "m4v", "ogv",
    # voice notes
    "m4a", "mp3", "wav", "ogg", "oga", "weba",
    # documents and archives
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "rtf", "txt", "md", "csv",
    "zip", "7z", "rar", "tar", "gz",
}
# Types the browser may show inline when the URL is opened directly. Everything else downloads.
INLINE_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp",
    "video/mp4", "video/webm", "video/quicktime", "video/ogg",
    "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm",
    "application/pdf",
}
UPLOAD_ID_RE = re.compile(r"^[A-Za-z0-9_-]{22}$")
SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_name(original: str) -> str:
    base = Path(original or "file").name  # drop any client-supplied directories
    stem, dot, ext = base.rpartition(".")
    if not dot:
        stem, ext = base, ""
    stem = SAFE_NAME_RE.sub("-", stem).strip("-.")[:80] or "file"
    ext = SAFE_NAME_RE.sub("", ext).lower()[:10]
    return f"{stem}.{ext}" if ext else stem


@app.post("/uploads")
async def upload(file: UploadFile = File(...)) -> dict[str, Any]:
    name = _safe_name(file.filename or "")
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, f"'.{ext or '?'}' files aren't supported. Use images, videos, audio, PDFs, docs or zips.")

    upload_id = secrets.token_urlsafe(16)  # 22 url-safe chars, 128 random bits
    folder = UPLOAD_DIR / upload_id
    folder.mkdir(parents=True, exist_ok=False)
    target = folder / name
    size = 0
    try:
        with target.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "That file is over the 25 MB limit.")
                out.write(chunk)
    except BaseException:
        target.unlink(missing_ok=True)
        folder.rmdir()
        raise
    return {"url": f"/api/uploads/{upload_id}/{quote(name)}", "name": name, "size": size}


@app.get("/uploads/{upload_id}/{name}")
def get_upload(upload_id: str, name: str) -> FileResponse:
    if not UPLOAD_ID_RE.match(upload_id) or _safe_name(name) != name:
        raise HTTPException(404, "Not found")
    path = (UPLOAD_DIR / upload_id / name).resolve()
    if path.parent.parent != UPLOAD_DIR or not path.is_file():
        raise HTTPException(404, "Not found")
    media_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    inline = media_type in INLINE_TYPES
    headers = {
        "X-Content-Type-Options": "nosniff",
        # Opened directly, an upload can never run script on the app's origin (SVG, HTML in a zip, ...).
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "private, max-age=31536000, immutable",
    }
    return FileResponse(
        path,
        media_type=media_type,
        headers=headers,
        filename=name,
        content_disposition_type="inline" if inline else "attachment",
    )
