"""Tracer tests for the STT model-dir + /models/status seam (ticket #2).

Seam (c): model download location per OS, exposable helper + status route.
Glossary: no domain terms needed here (infrastructure for future Transcripts).
"""

import os

os.environ.setdefault("SIDECAR_TOKEN", "test-token")

from pathlib import Path

from fastapi.testclient import TestClient

import stt
from main import app


def _client() -> TestClient:
    return TestClient(app)


def test_model_dir_windows_uses_appdata():
    assert stt.model_dir(platform="win32", appdata="C:\\Users\\Ada\\AppData\\Roaming") == (
        Path("C:\\Users\\Ada\\AppData\\Roaming") / "speak-flow" / "models"
    )


def test_model_dir_prefers_xdg_data_home_on_linux(tmp_path: Path):
    assert stt.model_dir(
        platform="linux", xdg_data_home=str(tmp_path / "data"), home="/home/ada"
    ) == tmp_path / "data" / "speak-flow" / "models"


def test_model_dir_falls_back_to_home_local_share_on_linux():
    assert stt.model_dir(platform="linux", xdg_data_home="", home="/home/ada") == (
        Path("/home/ada") / ".local" / "share" / "speak-flow" / "models"
    )


def test_models_status_reports_path_and_missing_flag(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(stt, "get_model_dir", lambda: tmp_path / "models")
    status = stt.models_status()
    assert status["model"] == "small-int8"
    assert status["downloaded"] is False
    assert status["path"] == str(tmp_path / "models")


def test_models_status_http_requires_token():
    assert _client().get("/models/status").status_code == 401


def test_models_status_http_ok_with_valid_token(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(stt, "get_model_dir", lambda: tmp_path / "models")
    response = _client().get(
        "/models/status", headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "small-int8"
    assert body["downloaded"] is False


def test_models_download_requires_token():
    assert _client().post("/models/download").status_code == 401


def test_models_download_starts_and_reports_contract(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(stt, "get_model_dir", lambda: tmp_path / "models")
    response = _client().post(
        "/models/download", headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["started"] is True
    assert body["downloaded"] is False
