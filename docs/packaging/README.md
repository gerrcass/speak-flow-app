# Packaging (ticket #6, ADR-0002)

NSIS installer via electron-builder (`apps/desktop/package.json` `build` key); model weights are excluded (`!**/models/**`, `*.pt/bin/onnx`) and download on first run (see ModelsPanel + `GET /models/status`); electron-updater checks the stub feed at startup (`build.publish.url`, overridable via `SPEAK_FLOW_UPDATE_URL`).
