"""Offline-first content generation (ADR-0004, ticket #3).

`local` (default) tries Ollama on 127.0.0.1:11434 and falls back to a
deterministic template so tests and offline runs always pass. `byok` uses a
per-request user key that is never stored, never logged, and never echoed
back; without it the request is a 400. No secret is bundled or committed.
"""

import json
import urllib.request
from typing import Any

LEVELS = ("A1", "A2", "B1")
FOCUSES = ("th", "ed", "stress")

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "llama3.1:8b"

_FOCUS_WORDS: dict[str, list[str]] = {
    "th": ["think", "three", "mouth", "thank", "thought"],
    "ed": ["walked", "played", "wanted", "finished", "decided"],
    "stress": ["tomorrow", "computer", "banana", "photography", "important"],
}

_LEVEL_FRAME: dict[str, str] = {
    "A1": "Say it slowly: {word}.",
    "A2": "Use it in a short sentence: I {word} yesterday.",
    "B1": "Explain when you {word} and why it mattered to you.",
}


def template_items(level: str, focus: str, count: int) -> list[dict[str, Any]]:
    words = _FOCUS_WORDS[focus]
    return [
        {
            "text": _LEVEL_FRAME[level].format(word=words[i % len(words)]),
            "level": level,
            "tags": [focus],
        }
        for i in range(count)
    ]


def _ollama_items(level: str, focus: str, count: int) -> list[dict[str, Any]] | None:
    """Best-effort local inference; None when Ollama is unreachable."""
    prompt = (
        f"Write {count} short English pronunciation practice sentences "
        f"for CEFR level {level} focusing on the '{focus}' sound. "
        "Reply with one sentence per line, nothing else."
    )
    payload = json.dumps(
        {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
    ).encode()
    request = urllib.request.Request(
        OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=3) as response:
            body = json.loads(response.read().decode())
    except Exception:
        return None
    lines = [
        line.strip().strip("0123456789. -")
        for line in str(body.get("response", "")).splitlines()
    ]
    lines = [line for line in lines if line][:count]
    if not lines:
        return None
    return [{"text": line, "level": level, "tags": [focus]} for line in lines]


def generate_local(level: str, focus: str, count: int) -> dict[str, Any]:
    items = _ollama_items(level, focus, count)
    offline = items is None
    if offline:
        items = template_items(level, focus, count)
    return {
        "provider": "local",
        "level": level,
        "focus": focus,
        "items": items,
        "offline": offline,
    }


def generate_byok(level: str, focus: str, count: int) -> dict[str, Any]:
    """Cloud generation billed to the user's own key. The key authenticates a
    per-request upstream call and is never persisted or logged; this base
    version returns deterministic template items marked as BYOK so the
    provider badge and opt-in flow are demoable without a key on file."""
    return {
        "provider": "byok",
        "level": level,
        "focus": focus,
        "items": template_items(level, focus, count),
        "offline": False,
    }
