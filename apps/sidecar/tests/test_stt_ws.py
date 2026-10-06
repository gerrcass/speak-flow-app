"""Tracer tests for the sidecar WS /stt/stream seam (ticket #2).

Contract: client streams 16kHz PCM16 mono binary chunks, server replies
JSON {type: partial|final, text}; text {"type": "end"} asks for the final
Transcript. When weights are missing the server first emits
{type: download-progress, pct}. Glossary: Transcript.
"""

import os

os.environ.setdefault("SIDECAR_TOKEN", "test-token")

from fastapi.testclient import TestClient

import stt
from main import app


class _StubEngine:
    def __init__(self, partial="hello", final="hello world"):
        self.partial = partial
        self.final = final
        self.seen: list[bytes] = []

    def download_progress(self) -> list[int]:
        return []

    def transcribe_partial(self, pcm16: bytes) -> str:
        self.seen.append(pcm16)
        return self.partial

    def transcribe_final(self, pcm16: bytes) -> str:
        self.seen.append(pcm16)
        return self.final


def _client() -> TestClient:
    return TestClient(app)


def test_ws_rejects_wrong_token():
    with _client() as client:
        try:
            with client.websocket_connect("/stt/stream?token=wrong"):
                raise AssertionError("expected the socket to be refused")
        except Exception:
            pass


def test_ws_rejects_missing_token_when_server_has_none(monkeypatch):
    monkeypatch.setenv("SIDECAR_TOKEN", "")
    with _client() as client:
        try:
            with client.websocket_connect("/stt/stream"):
                raise AssertionError("expected the socket to be refused")
        except Exception:
            pass


def test_ws_partial_then_final_transcript(monkeypatch):
    engine = _StubEngine()
    monkeypatch.setattr(stt, "get_transcriber", lambda: engine)
    monkeypatch.setattr(stt, "is_model_downloaded", lambda directory=None: True)
    with _client() as client, client.websocket_connect(
        "/stt/stream?token=test-token"
    ) as ws:
        ws.send_bytes(b"\x00\x01" * 1600)
        assert ws.receive_json() == {"type": "partial", "text": "hello"}
        ws.send_json({"type": "end"})
        assert ws.receive_json() == {"type": "final", "text": "hello world"}
    assert engine.seen == [b"\x00\x01" * 1600, b"\x00\x01" * 1600]


def test_ws_emits_download_progress_when_model_missing(monkeypatch):
    class _Downloading(_StubEngine):
        def download_progress(self) -> list[int]:
            return [0, 50, 100]

    monkeypatch.setattr(stt, "get_transcriber", lambda: _Downloading())
    monkeypatch.setattr(stt, "is_model_downloaded", lambda directory=None: False)
    with _client() as client, client.websocket_connect(
        "/stt/stream?token=test-token"
    ) as ws:
        assert ws.receive_json() == {"type": "download-progress", "pct": 0}
        assert ws.receive_json() == {"type": "download-progress", "pct": 50}
        assert ws.receive_json() == {"type": "download-progress", "pct": 100}
        ws.send_bytes(b"\x00\x01" * 800)
        assert ws.receive_json() == {"type": "partial", "text": "hello"}
