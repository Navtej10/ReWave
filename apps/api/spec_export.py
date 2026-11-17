"""Validation for the spec export (spec 09). The model's JSON is untrusted: evidence ids must be
input blip ids, claims with no real blip behind them become "Unconfirmed:" open questions, and
every list is capped."""
from __future__ import annotations

import re
from typing import Any, Iterable

MIN_HUMAN_SOURCES = 2
MAX_REQUIREMENTS = 8
MAX_CRITERIA = 8
MAX_ALTERNATIVES = 6
MAX_TRADEOFFS = 6
MAX_RISKS = 6
MAX_OPEN_QUESTIONS = 10
MAX_TASKS = 12
MAX_EVIDENCE = 8
MAX_NAMES = 6

THIN_NOTICE = "There was not enough discussion in this thread to derive requirements."
THIN_QUESTION = "What are the requirements for this decision? The thread did not contain enough discussion to derive them."

_CITE_RE = re.compile(r"\[b:[^\]]*\]")


def clean(value: Any, limit: int, one_line: bool = True) -> str:
    """A trimmed string without `[b:id]` markers, cut to `limit`; anything else is empty."""
    if not isinstance(value, str):
        return ""
    text = _CITE_RE.sub("", value)
    text = " ".join(text.split()) if one_line else text.strip()
    return text[:limit].rstrip()


def _items(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _strings(value: Any, cap: int, limit: int) -> list[str]:
    out: list[str] = []
    for item in _items(value):
        text = clean(item, limit)
        if text and text not in out:
            out.append(text)
        if len(out) >= cap:
            break
    return out


def _evidence(value: Any, known: set[str]) -> list[str]:
    out: list[str] = []
    for item in _items(value):
        if isinstance(item, str) and item in known and item not in out:
            out.append(item)
        if len(out) >= MAX_EVIDENCE:
            break
    return out


def is_thin(sources: Iterable[tuple[str, str]]) -> bool:
    """`sources` are (id, kind) pairs. Thin means fewer than 2 distinct human source blips."""
    humans = {blip_id for blip_id, kind in sources if kind == "human"}
    return len(humans) < MIN_HUMAN_SOURCES


def thin_spec(decision: str) -> dict[str, Any]:
    """The answer for a thread with too little discussion: the decision and a notice, no model call."""
    text = clean(decision, 600)
    return {
        "title": clean(text, 80),
        "introduction": "",
        "requirements": [],
        "design": {"decision": text, "alternatives": [], "tradeoffs": [], "risks": []},
        "openQuestions": [THIN_QUESTION],
        "tasks": [],
        "thin": True,
        "notice": THIN_NOTICE,
    }


def _raised_by(value: Any, evidence: list[str], author_of: dict[str, str]) -> list[str]:
    known_names = set(author_of.values())
    names: list[str] = []
    for name in _items(value):
        name = clean(name, 60)
        if name in known_names and name not in names:
            names.append(name)
    if not names:
        for blip_id in evidence:
            name = author_of.get(blip_id, "")
            if name and name not in names:
                names.append(name)
    return names[:MAX_NAMES]


def validate_spec(raw: Any, author_of: dict[str, str]) -> dict[str, Any] | None:
    """Turn the model's JSON into the response body, or None when nothing usable is left.

    `author_of` maps every input blip id to its author; its keys are the only valid evidence ids."""
    if not isinstance(raw, dict):
        return None
    known = set(author_of)
    open_questions = _strings(raw.get("openQuestions"), MAX_OPEN_QUESTIONS, 400)
    unconfirmed: list[str] = []

    requirements: list[dict[str, Any]] = []
    for item in _items(raw.get("requirements")):
        if not isinstance(item, dict):
            continue
        title = clean(item.get("title"), 120)
        if not title:
            continue
        criteria = _strings(item.get("criteria"), MAX_CRITERIA, 400)
        evidence = _evidence(item.get("evidence"), known)
        if not evidence:
            unconfirmed.append(f"Unconfirmed: {title} (no blip in the thread supports this requirement)")
            continue
        if not criteria:
            unconfirmed.append(f"Unconfirmed: {title} (the thread gives no acceptance criteria for it)")
            continue
        if len(requirements) >= MAX_REQUIREMENTS:
            continue
        requirements.append(
            {
                "title": title,
                "userStory": clean(item.get("userStory"), 400),
                "criteria": criteria,
                "evidence": evidence,
                "raisedBy": _raised_by(item.get("raisedBy"), evidence, author_of),
            }
        )

    raw_design = raw.get("design") if isinstance(raw.get("design"), dict) else {}
    alternatives: list[dict[str, Any]] = []
    for item in _items(raw_design.get("alternatives")):
        if not isinstance(item, dict):
            continue
        option = clean(item.get("option"), 200)
        if not option:
            continue
        evidence = _evidence(item.get("evidence"), known)
        if not evidence:
            unconfirmed.append(f"Unconfirmed: alternative \"{option}\" (no blip in the thread supports it)")
            continue
        if len(alternatives) >= MAX_ALTERNATIVES:
            continue
        alternatives.append({"option": option, "whyRejected": clean(item.get("whyRejected"), 400), "evidence": evidence})

    design = {
        "decision": clean(raw_design.get("decision"), 600),
        "alternatives": alternatives,
        "tradeoffs": _strings(raw_design.get("tradeoffs"), MAX_TRADEOFFS, 400),
        "risks": _strings(raw_design.get("risks"), MAX_RISKS, 400),
    }
    title = clean(raw.get("title"), 80)
    if not title and not design["decision"]:
        return None

    return {
        "title": title or clean(design["decision"], 80),
        "introduction": clean(raw.get("introduction"), 800),
        "requirements": requirements,
        "design": design,
        "openQuestions": (unconfirmed + open_questions)[:MAX_OPEN_QUESTIONS],
        "tasks": _strings(raw.get("tasks"), MAX_TASKS, 300),
        "thin": False,
        "notice": None,
    }
