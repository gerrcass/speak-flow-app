"""Tracer tests for the POST /score + GET /tts/example seam (ticket #4).

Seam: scoring mirrors the TS Pronunciation Score (100-WER) + Fluency Stats;
TTS serves real Piper audio when installed, else a deterministic WAV stub so
tests and offline demos pass with an honest header.
Glossary: Reference, Transcript, Pronunciation Score, Fluency Stats, Attempt.
"""

import os
import struct
import wave
from io import BytesIO

os.environ.setdefault("SIDECAR_TOKEN", "test-token")

from fastapi.testclient import TestClient

from main import app


def _client() -> TestClient:
    return TestClient(app)


def _auth() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


def test_score_identical_texts_score_100():
    response = _client().post(
        "/score",
        headers=_auth(),
        json={"reference": "the cat sat", "transcript": "the cat sat"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["wer"] == 0
    assert body["score"] == 100
    assert body["failed_words"] == []
    assert body["band"] == "pass"


def test_score_one_substitution_scores_67_with_failed_word():
    response = _client().post(
        "/score",
        headers=_auth(),
        json={"reference": "the cat sat", "transcript": "the dog sat"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["score"] == 67
    assert body["failed_words"] == ["cat"]
    assert body["band"] == "fail"


def test_score_fluency_from_durations():
    response = _client().post(
        "/score",
        headers=_auth(),
        json={
            "reference": "the cat sat on the mat today now word nine ten eleven twelve",
            "transcript": "well I think um the cat sat on the mat today now",
            "speech_ms": 6000,
            "total_ms": 10000,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["wpm"] == 120
    assert body["pause_ratio"] == 0.4
    assert body["filler_rate"] == 10


def test_score_requires_auth():
    response = _client().post(
        "/score", json={"reference": "a", "transcript": "a"}
    )
    assert response.status_code == 401


def test_score_rejects_empty_reference():
    response = _client().post(
        "/score", headers=_auth(), json={"reference": " ", "transcript": "hi"}
    )
    assert response.status_code == 400


def test_tts_example_returns_wav_audio_with_honest_header():
    response = _client().get(
        "/tts/example", headers=_auth(), params={"text": "the cat sat"}
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/wav")
    assert response.headers["x-tts-engine"] in ("piper", "stub")
    with wave.open(BytesIO(response.content), "rb") as wav:
        assert wav.getnchannels() == 1
        assert wav.getframerate() == 16000
        assert wav.getnframes() > 0


def test_tts_example_rejects_empty_text():
    response = _client().get("/tts/example", headers=_auth(), params={"text": " "})
    assert response.status_code == 400


def test_tts_example_requires_auth():
    response = _client().get("/tts/example", params={"text": "hi"})
    assert response.status_code == 401
