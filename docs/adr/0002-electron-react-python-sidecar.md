# 0002 Electron + React + Python sidecar for MVP

With i7 + 32GB and React familiarity, weight is not a constraint. Electron gives the best React DX, proven Chromium mic capture and mature auto-update/installer, while all ML (STT/scoring/TTS) lives in a Python FastAPI sidecar on localhost. We accept a ~90MB+ installer to iterate UI fast; the renderer talks to `127.0.0.1` via token so a future Tauri port would not touch React code.

## Considered Options

- Tauri 2 + React + Python sidecar: lighter installer but Rust friction + WebView2 mic quirks on Win10, same sidecar cost anyway.
- Python-only PySide6: fastest ML integration but weaker UI/UX for React dev, discarded after weight constraint lifted.
- Electron WASM-only without Python: no serious local port of OpenPronounce/WavLM/Parakeet, 2-3x slower.
