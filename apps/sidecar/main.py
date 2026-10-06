"""Local sidecar for speak-flow-app (ADR-0002).

FastAPI service bound to 127.0.0.1 only. Every route requires the Bearer
token spawned by the Electron main process via the SIDECAR_TOKEN env var.
Ticket #1 exposes GET /health only; STT/scoring routes arrive in later tickets.
"""

import os

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

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


def main() -> None:
    if not os.environ.get("SIDECAR_TOKEN"):
        raise RuntimeError("SIDECAR_TOKEN env var is required")
    port = int(os.environ.get("SIDECAR_PORT", "4317"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
