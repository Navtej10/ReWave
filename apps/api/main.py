import json
import mimetypes
import os
import re
import secrets
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from agents import AGENTS, CARD_FORMAT

load_dotenv()

app = FastAPI(title="Rewave agents API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
_client: Anthropic | None = None


def client() -> Anthropic:
    global _client
    if _client is None:
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise HTTPException(500, "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.")
        _client = Anthropic()
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


@app.post("/agents/{agent}", response_model=AgentResponse)
def run_agent(agent: str, req: AgentRequest) -> AgentResponse:
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
    msg = client().messages.create(
        model=MODEL,
        max_tokens=800,
        system=f"{system}\n\n{CARD_FORMAT.get(agent, '')}",
        messages=[{"role": "user", "content": f"Wave thread:\n{transcript}"}],
    )
    raw_text = "".join(part.text for part in msg.content if part.type == "text")
    known = {b.id for b in req.blips}
    thread_urls = set(URL_RE.findall(transcript))

    parsed = _first_json_object(raw_text)
    card = _build_card(agent, parsed, known, thread_urls) if parsed else None
    text = _card_to_text(card) if card else _drop_unknown_citations(raw_text, known)
    sources = [s for s in dict.fromkeys(CITE_RE.findall(text)) if s in known]
    return AgentResponse(text=text, sources=sources, card=card)


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
