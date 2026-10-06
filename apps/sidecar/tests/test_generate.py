"""Tracer tests for POST /content/generate (ticket #3, ADR-0004).

Local inference is the offline default; BYOK is opt-in cloud via a user key
sent per-request in a header, never stored server-side, never logged, never
committed.
"""

import os

os.environ.setdefault("SIDECAR_TOKEN", "test-token")

from fastapi.testclient import TestClient

from main import app

HEADERS = {"Authorization": "Bearer test-token"}


def _client() -> TestClient:
    return TestClient(app)


def test_generate_defaults_to_local_offline():
    response = _client().post("/content/generate", headers=HEADERS, json={})
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "local"
    assert len(body["items"]) >= 1
    assert all("text" in item and "level" in item for item in body["items"])


def test_generate_local_honours_level_focus_count():
    response = _client().post(
        "/content/generate",
        headers=HEADERS,
        json={"provider": "local", "level": "A1", "focus": "th", "count": 3},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "local"
    assert len(body["items"]) == 3
    assert all(item["level"] == "A1" for item in body["items"])


def test_generate_byok_without_key_is_400():
    response = _client().post(
        "/content/generate", headers=HEADERS, json={"provider": "byok"}
    )
    assert response.status_code == 400


def test_generate_byok_with_key_never_echoes_key():
    response = _client().post(
        "/content/generate",
        headers={**HEADERS, "X-Provider-Key": "user-secret-key"},
        json={"provider": "byok", "level": "A2", "focus": "ed", "count": 2},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "byok"
    assert len(body["items"]) == 2
    assert "user-secret-key" not in response.text


def test_generate_rejects_bad_provider():
    response = _client().post(
        "/content/generate", headers=HEADERS, json={"provider": "handy"}
    )
    assert response.status_code in (400, 422)


def test_generate_requires_sidecar_token():
    response = _client().post("/content/generate", json={})
    assert response.status_code == 401
