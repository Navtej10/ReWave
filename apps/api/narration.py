"""Validation of replay captions (spec 08). The model's answer is untrusted: only captions that
point at a real input blip survive, ordered by position in the thread."""
from __future__ import annotations

import re
from typing import Any

MAX_CAPTIONS = 6
MAX_CAPTION_CHARS = 280

_CITE_RE = re.compile(r"\[b:[^\]]*\]")


def _clean_text(value: Any, max_chars: int) -> str:
    if not isinstance(value, str):
        return ""
    text = " ".join(_CITE_RE.sub("", value).split())
    if len(text) <= max_chars:
        return text
    cut = text[: max_chars - 1]
    # Prefer ending on a word boundary.
    if " " in cut[max_chars // 2 :]:
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:") + "\u2026"


def validate_captions(
    raw: Any,
    order: list[str],
    max_captions: int = MAX_CAPTIONS,
    max_chars: int = MAX_CAPTION_CHARS,
) -> list[dict[str, str]]:
    """Keep captions whose `atBlipId` is in `order`, drop duplicates and empty text, strip `[b:id]`
    markers, sort by position in `order`, and cap the count and the text length."""
    items = raw.get("captions") if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        return []
    position = {blip_id: i for i, blip_id in enumerate(order)}
    seen: set[str] = set()
    kept: list[tuple[int, str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        blip_id = item.get("atBlipId")
        if not isinstance(blip_id, str) or blip_id not in position or blip_id in seen:
            continue
        text = _clean_text(item.get("text"), max_chars)
        if not text:
            continue
        seen.add(blip_id)
        kept.append((position[blip_id], blip_id, text))
    kept.sort(key=lambda k: k[0])
    return [{"atBlipId": blip_id, "text": text} for _, blip_id, text in kept[: max(0, max_captions)]]
