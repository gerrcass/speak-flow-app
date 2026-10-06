"""Local sidecar for speak-flow-app (ADR-0002).

FastAPI service bound to 127.0.0.1 only. Every route requires the Bearer
token spawned by the Electron main process via the SIDECAR_TOKEN env var.
Ticket #1 exposed GET /health; ticket #2 adds the STT stream + model status.
"""

import os

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException, Response, WebSocket, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from typing import Literal

import content_gen
import scoring
import stt
import tts

_bearer = HTTPBearer(auto_error=False)

app = FastAPI(title="speak-flow-sidecar")


def require_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    expected = os.environ.get("SIDECAR_TOKEN", "")
    provided = credentials.credentials if credentials else ""
    if not expected or provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid sidecar token"
        )


@app.get("/health", dependencies=[Depends(require_token)])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/models/status", dependencies=[Depends(require_token)])
def models_status() -> dict[str, object]:
    return stt.models_status()


@app.post("/models/download", dependencies=[Depends(require_token)])
def models_download() -> dict[str, object]:
    """First-run trigger for model weights (ticket #6): starts the download
    (real load when faster-whisper is present, honest stub otherwise).
    Progress is reported via GET /models/status and the STT stream
    download-progress channel."""
    return stt.trigger_model_download()


class GenerateRequest(BaseModel):
    """POST /content/generate body (ADR-0004, ticket #3). Local inference is
    the offline default; BYOK is opt-in cloud billed to the user's own key."""

    provider: Literal["local", "byok"] = "local"
    level: str = "A2"
    focus: str = "th"
    count: int = Field(default=5, ge=1, le=20)


@app.post("/content/generate", dependencies=[Depends(require_token)])
def content_generate(
    request: GenerateRequest,
    x_provider_key: str | None = Header(default=None),
) -> dict[str, object]:
    if request.level not in content_gen.LEVELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="unknown level"
        )
    if request.focus not in content_gen.FOCUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="unknown focus"
        )
    if request.provider == "byok":
        # The user key travels per-request in a header and is never stored
        # server-side, never logged, and never echoed back. Missing key is a
        # 400 (client error), not a 401 (sidecar token is already valid here).
        if not x_provider_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="byok provider needs an X-Provider-Key header",
            )
        return content_gen.generate_byok(request.level, request.focus, request.count)
    return content_gen.generate_local(request.level, request.focus, request.count)


class ScoreRequest(BaseModel):
    """POST /score body (ticket #4). Reference is the exact expected text,
    Transcript is what STT heard; durations are VAD-style milliseconds."""

    reference: str
    transcript: str = ""
    speech_ms: int = Field(default=0, ge=0)
    total_ms: int = Field(default=0, ge=0)


@app.post("/score", dependencies=[Depends(require_token)])
def score_attempt(request: ScoreRequest) -> dict[str, object]:
    if not request.reference.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="reference must not be empty"
        )
    score = scoring.pronunciation_score(request.reference, request.transcript)
    fluency = scoring.compute_fluency(
        request.transcript, request.speech_ms, request.total_ms
    )
    return {
        "wer": round(scoring.compute_wer(request.reference, request.transcript), 2),
        "score": score,
        "band": scoring.score_band(score),
        "failed_words": scoring.failed_words(request.reference, request.transcript),
        **fluency,
    }


@app.get("/tts/example", dependencies=[Depends(require_token)])
def tts_example(text: str = "") -> Response:
    """Piper TTS example for Repeat-after-me. X-TTS-Engine says honestly
    whether real Piper or the offline stub served the audio."""
    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="text must not be empty"
        )
    wav, engine = tts.synthesize(text)
    return Response(
        content=wav,
        media_type="audio/wav",
        headers={"X-TTS-Engine": engine},
    )


def _is_end_message(raw: str) -> bool:
    import json

    try:
        return json.loads(raw).get("type") == "end"
    except (ValueError, AttributeError):
        return raw.strip() == "end"


@app.websocket("/stt/stream")
async def stt_stream(websocket: WebSocket) -> None:
    """Local STT stream (ticket #2): binary 16kHz PCM16 mono chunks in,
    JSON {type: partial|final, text} Transcript out. Browsers cannot set WS
    headers, so the sidecar token travels as ?token= (same per-boot secret
    as the HTTP routes, localhost only per ADR-0002)."""
    expected = os.environ.get("SIDECAR_TOKEN", "")
    provided = websocket.query_params.get("token") or ""
    if not expected or provided != expected:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    engine = stt.get_transcriber()
    for pct in engine.download_progress():
        await websocket.send_json({"type": "download-progress", "pct": pct})
    buffer = bytearray()
    while True:
        try:
            message = await websocket.receive()
        except Exception:
            return
        if "bytes" in message and message["bytes"] is not None:
            buffer += message["bytes"]
            text = engine.transcribe_partial(bytes(buffer))
            await websocket.send_json({"type": "partial", "text": text})
        elif "text" in message and message["text"] is not None:
            if _is_end_message(message["text"]):
                text = engine.transcribe_final(bytes(buffer))
                await websocket.send_json({"type": "final", "text": text})
                buffer.clear()
        else:
            return


def main() -> None:
    if not os.environ.get("SIDECAR_TOKEN"):
        raise RuntimeError("SIDECAR_TOKEN env var is required")
    port = int(os.environ.get("SIDECAR_PORT", "4317"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
