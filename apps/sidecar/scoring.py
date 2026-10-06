"""Scoring for Repeat-after-me + Read-Aloud (ticket #4).

Source of truth for served scores is this file; the desktop scoring.ts is
the offline-display mirror (same algorithm, tested to match). Keep both in
sync when either changes.

Mirrors apps/desktop/src/scoring/scoring.ts: Pronunciation Score = 100-WER
over lowercased word tokens, failed words via alignment, Fluency Stats
(WPM, pause ratio, filler rate) from VAD-style durations. Pure functions so
both the sidecar route and pytest exercise the same code.
"""

import re

FILLERS = frozenset({"um", "uh", "er", "ah", "hmm", "eh", "mm"})

_TOKEN_SPLIT = re.compile(r"[^a-z0-9']+")


def tokenize(text: str) -> list[str]:
    return [w for w in _TOKEN_SPLIT.split(text.lower()) if w]


def _levenshtein(ref: list[str], hyp: list[str]) -> int:
    prev = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, start=1):
        diag = prev[0]
        prev[0] = i
        for j, h in enumerate(hyp, start=1):
            temp = prev[j]
            prev[j] = min(prev[j] + 1, prev[j - 1] + 1, diag + (0 if r == h else 1))
            diag = temp
    return prev[len(hyp)]


def compute_wer(reference: str, transcript: str) -> float:
    ref = tokenize(reference)
    hyp = tokenize(transcript)
    if not ref:
        return 0.0 if not hyp else 100.0
    return _levenshtein(ref, hyp) / len(ref) * 100.0


def pronunciation_score(reference: str, transcript: str) -> int:
    return max(0, round(100 - compute_wer(reference, transcript)))


def failed_words(reference: str, transcript: str) -> list[str]:
    ref = tokenize(reference)
    hyp = tokenize(transcript)
    rows, cols = len(ref) + 1, len(hyp) + 1
    dp = [[(i if j == 0 else j) for j in range(cols)] for i in range(rows)]
    for i in range(1, rows):
        for j in range(1, cols):
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1),
            )
    failed: list[str] = []
    i, j = len(ref), len(hyp)
    while i > 0:
        if j > 0 and ref[i - 1] == hyp[j - 1] and dp[i][j] == dp[i - 1][j - 1]:
            i -= 1
            j -= 1
        elif j > 0 and ref[i - 1] != hyp[j - 1] and dp[i][j] == dp[i - 1][j - 1] + 1:
            failed.insert(0, ref[i - 1])
            i -= 1
            j -= 1
        elif dp[i][j] == dp[i - 1][j] + 1:
            failed.insert(0, ref[i - 1])
            i -= 1
        else:
            j -= 1
    return failed


def score_band(score: int) -> str:
    if score > 85:
        return "pass"
    if score >= 70:
        return "warn"
    return "fail"


def compute_fluency(transcript: str, speech_ms: int, total_ms: int) -> dict:
    """Honest stub: pause_ratio derives from caller durations, not a real VAD."""
    words = tokenize(transcript)
    minutes = speech_ms / 60000
    fillers = [w for w in words if w in FILLERS]
    return {
        "wpm": round(len(words) / minutes) if speech_ms > 0 else 0,
        "pause_ratio": 1 - speech_ms / total_ms if total_ms > 0 else 1.0,
        "filler_rate": len(fillers) / minutes if minutes > 0 else 0.0,
        "fillers": fillers,
    }
