"""Tracer tests for the sidecar GET /health seam (ticket #1).

Uses Glossary terms only where relevant; sidecar health is infrastructure.
"""

import os

os.environ.setdefault("SIDECAR_TOKEN", "test-token")

from fastapi.testclient import TestClient

from main import app


def _client() -> TestClient:
    return TestClient(app)


def test_health_ok_with_valid_token():
    response = _client().get("/health", headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_rejects_missing_token():
    response = _client().get("/health")
    assert response.status_code == 401


def test_health_rejects_wrong_token():
    response = _client().get("/health", headers={"Authorization": "Bearer wrong"})
    assert response.status_code == 401
