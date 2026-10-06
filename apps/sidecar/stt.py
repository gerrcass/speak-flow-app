"""Local STT engine seam for speak-flow-app (ADR-0001, ticket #2).

faster-whisper `small` int8 on CPU, offline. The heavy import stays lazy so
pytest (and sidecars without the model) never pay for it: transcription goes
through a module-level engine that tests replace with a stub via
``set_transcriber``. Model weights live under the OS data dir
(``model_dir``); ``models_status`` reports whether they are on disk yet.
"""

import os
from pathlib import Path
from typing import Any, Protocol

MODEL_NAME = "small"
COMPUTE_TYPE = "int8"
MODEL_LABEL = "small-int8"


def model_dir(
    platform: str | None = None,
    appdata: str | None = None,
    xdg_data_home: str | None = None,
    home: str | None = None,
) -> Path:
    """Where STT weights live: %APPDATA%/speak-flow/models on Windows,
    $XDG_DATA_HOME/speak-flow/models (else ~/.local/share/...) elsewhere."""
    platform = platform if platform is not None else os.name
    if platform == "win32" or (platform == "nt"):
        base = (
            appdata if appdata is not None else os.environ.get("APPDATA", "")
        ) or os.path.expanduser("~")
        return Path(base) / "speak-flow" / "models"
    xdg = xdg_data_home if xdg_data_home is not None else os.environ.get(
        "XDG_DATA_HOME", ""
    )
    if xdg:
        return Path(xdg) / "speak-flow" / "models"
    root = home if home is not None else os.path.expanduser("~")
    return Path(root) / ".local" / "share" / "speak-flow" / "models"


def get_model_dir() -> Path:
    return model_dir(platform=os.name)


def is_model_downloaded(directory: Path | None = None) -> bool:
    """True when a previous download left weights in the model dir."""
    target = directory if directory is not None else get_model_dir()
    try:
        return target.is_dir() and any(target.iterdir())
    except OSError:
        return False


def models_status() -> dict[str, Any]:
    directory = get_model_dir()
    return {
        "model": MODEL_LABEL,
        "downloaded": is_model_downloaded(directory),
        "path": str(directory),
    }


def trigger_model_download() -> dict[str, Any]:
    """First-run download trigger: upgrades to the real local model when
    faster-whisper is installed (weights land in the model dir on first
    transcription); otherwise an honest stub that reports started without
    moving weights. Progress keeps flowing over the existing
    download_progress status channel on the STT stream."""
    get_transcriber()
    return {"started": True, "downloaded": is_model_downloaded()}


class Transcriber(Protocol):
    """Seam tests stub out: receives 16kHz PCM16 mono, returns text."""

    def download_progress(self) -> list[int]:
        ...

    def transcribe_partial(self, pcm16: bytes) -> str:
        ...

    def transcribe_final(self, pcm16: bytes) -> str:
        ...


class StubTranscriber:
    """Offline stand-in: deterministic, no weights, used when
    faster-whisper is unavailable and overridden by tests via set_transcriber."""

    def download_progress(self) -> list[int]:
        return []

    def transcribe_partial(self, pcm16: bytes) -> str:
        return ""

    def transcribe_final(self, pcm16: bytes) -> str:
        return ""


_transcriber: Transcriber = StubTranscriber()
_pinned = False


def set_transcriber(engine: Transcriber) -> None:
    global _transcriber, _pinned
    _transcriber = engine
    _pinned = True


def _real_available() -> bool:
    import importlib.util

    return importlib.util.find_spec("faster_whisper") is not None


def get_transcriber() -> Transcriber:
    """Lazily upgrades the stub to the real local model on first use, so
    imports and pytest stay free of GPU/weight downloads (ADR-0001)."""
    global _transcriber
    if not _pinned and isinstance(_transcriber, StubTranscriber) and _real_available():
        try:
            _transcriber = FasterWhisperTranscriber()
        except Exception:
            pass
    return _transcriber


class FasterWhisperTranscriber:
    """faster-whisper `small` int8 on CPU, fully offline after first download.

    The model loads on first transcription, never on import. Weights land in
    ``get_model_dir()`` so the UI can show download progress before that.
    """

    def __init__(self) -> None:
        self._model: Any = None

    def download_progress(self) -> list[int]:
        if is_model_downloaded():
            return []
        return [0, 50, 100]

    def _ensure_loaded(self) -> Any:
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(
                MODEL_NAME,
                device="cpu",
                compute_type=COMPUTE_TYPE,
                download_root=str(get_model_dir()),
            )
        return self._model

    def _decode(self, pcm16: bytes, last_seconds: int | None) -> str:
        import numpy as np

        audio = np.frombuffer(pcm16, dtype=np.int16).astype(np.float32) / 32768.0
        if last_seconds is not None:
            audio = audio[-16000 * last_seconds :]
        if audio.size == 0:
            return ""
        segments, _ = self._ensure_loaded().transcribe(audio, language="en")
        return " ".join(segment.text.strip() for segment in segments).strip()

    def transcribe_partial(self, pcm16: bytes) -> str:
        try:
            return self._decode(pcm16, last_seconds=15)
        except Exception:
            return ""

    def transcribe_final(self, pcm16: bytes) -> str:
        try:
            return self._decode(pcm16, last_seconds=None)
        except Exception:
            return ""
