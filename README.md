# Speak Flow App

Local-first Windows desktop app for English speaking practice. Electron + React + TypeScript frontend with a Python FastAPI sidecar on `127.0.0.1` for transcription, scoring, and speech synthesis. Offline by default, no paid API required.

Practice formats (MVP): **Repeat-after-me**, **Read-Aloud**, **Free-talk**. Spaced-repetition **Drills** promote failed phrases into an SM-2 queue. See `GLOSSARY.md` for domain terms and `docs/roadmap-practice-formats.md` for the format catalog.

## Features

- Repeat-after-me + Read-Aloud scored loop: **Reference** display, Piper TTS example, recorded **Attempt**, **Pronunciation Score** (`100 - WER`) with pass/warn/fail token colors and failed-word list, **Fluency Stats** (WPM, pause ratio, filler rate).
- Free-talk loop: **Prompt** cue card, 45/60/90s timer, soft rubric only (keyword recall, TTR, CEFR hints — no hard grade), persisted to local SQLite with history list.
- Local STT: 16 kHz mic capture streams to the sidecar WebSocket `/stt/stream` (partial + final **Transcript**), faster-whisper `small-int8` on CPU, on-demand model download with progress.
- Content Packs: `phrases_100.json` (levels + th/ed/stress tags), `prompts_30.json`, minimal-pairs seed, schema-verified loading, manual paste-import, and `POST /content/generate` (local Ollama default, opt-in BYOK).
- SRS Drills + history: `DrillQualified` gating (WER > 30% or 2x failed word), SM-2 queue (1d/3d/7d), tricky-phrases view, 7-day intelligibility trend.
- Design system: W3C tokens as single source (`tokens.json` generates CSS + typed TS), closed-union `Button` contract, CI hex-gate.
- Lifecycle safety: `gdp-ts` proofs (`AttemptTranscribed`, `ContentPackVerified`, `DrillQualified`) with ESLint preset green.

## Architecture

```text
apps/desktop  Electron (main + preload) + React renderer (Vite)
  └─ supervises apps/sidecar on 127.0.0.1:<port> with per-boot Bearer token
apps/sidecar  FastAPI: /health, /stt/stream (WS), /models/*, /score,
              /tts/example, /content/generate — all token-gated
content/      phrases_100.json, prompts_30.json, minimal_pairs.json
```

Key decisions: `docs/adr/` (0001 direct local models, 0002 Electron + sidecar, 0003 tokens stack, 0004 local-first + BYOK, 0005 gdp-ts proofs).

## Prerequisites

- Node.js 22 + `pnpm` 9.15.9 (`pnpm` is pinned via `packageManager`).
- Python 3.11+ (sidecar; CI uses 3.11).
- A desktop OS for `pnpm dev` (Electron opens a window; headless CI runs build/typecheck/tests only).
- Optional, offline-first: Ollama on `127.0.0.1:11434` for local content generation; Piper binary for real TTS (otherwise deterministic offline stubs are used and labelled as such).

## Quickstart

```sh
# 1. Install JS workspaces
pnpm install

# 2. Install sidecar deps (light: API + tests only, no ML weights)
pip install -r apps/sidecar/requirements-dev.txt
# If pip crashes with an AssertionError in resolvelib, upgrade it first:
# python3 -m pip install --upgrade pip

# 2b. Optional: real local transcription (faster-whisper small-int8, ~100MB).
# Without it the sidecar runs with an honest stub so every flow stays demoable.
# pip install -r apps/sidecar/requirements-stt.txt

# 3. Run the sidecar (separate terminal; Electron spawns it automatically in dev)
SIDECAR_TOKEN=dev-token SIDECAR_PORT=4317 \
  python3 apps/sidecar/main.py
# check: curl -H "Authorization: Bearer dev-token" http://127.0.0.1:4317/health
# → {"status":"ok"}

# 4. Run the desktop app
pnpm dev
```

First run downloads speech models on demand to `%APPDATA%/speak-flow/models` (Windows) or `$XDG_DATA_HOME/speak-flow/models` (Linux/macOS). Use the in-app Models screen ("Download models") or trigger the first transcription; progress is shown in the UI.

### Trying each loop

1. **Repeat-after-me / Read-Aloud**: open Practice, pick a Reference, play the TTS example, press Record, speak ~10s, stop. The Transcript appears, then the Pronunciation Score band (pass > 85, warn 70–85, fail < 70), failed words, Fluency Stats, and the "emulación calibrada, no certificador" disclaimer. Use 1-tap retry or you-vs-TTS re-listen.
2. **Free-talk**: open Free-talk, pick a Prompt, choose 45/60/90s, record. The soft rubric (keyword recall, TTR, CEFR hints, Fluency Stats) is shown with no hard grade; the Attempt persists to SQLite and appears in history.
3. **Drills**: score < 70% (or a twice-failed word) qualifies the Attempt for SRS via `promoteToSrs`. Open Drills for due cards (1d/3d/7d) and History for the 7-day intelligibility trend.
4. **Content**: open Content to browse verified packs, paste-import your own phrases, or generate new ones (provider badge shows `Local (offline)` vs `BYOK (your key)`; BYOK keys live in the OS keychain via `safeStorage`, never in git).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SIDECAR_TOKEN` | (required) | Per-boot Bearer token for all sidecar routes |
| `SIDECAR_PORT` | `4317` | Sidecar port on `127.0.0.1` |
| `SPEAK_FLOW_DB` | `<userData>/speak-flow.db` | SQLite path override (tests use temp files) |
| `SPEAK_FLOW_UPDATE_URL` | `https://example.com/speak-flow/updates` | electron-updater feed (stub until release infra exists) |

BYOK keys are stored via Electron `safeStorage` (`<userData>/byok-key.bin`, mode 0600) with session-memory fallback; they travel per-request in `X-Provider-Key` and are never logged or committed.

## Testing

All commands below were verified green on the integration branch.

| Command | What it runs |
| --- | --- |
| `pnpm test` | Desktop node tests (66 TS tests) + sidecar pytest (29 tests) |
| `pnpm typecheck` | `tsc --noEmit` (renderer) incl. Button closed-union contract |
| `pnpm --filter @speak-flow/desktop lint` | ESLint (incl. gdp-ts proof preset) + hex-gate |
| `pnpm tokens:build` | Regenerate `tokens.css` + typed TS from `tokens.json` |
| `pnpm --filter @speak-flow/desktop build` | `tsc` + Vite production build + Electron main compile |
| `python3 -m pytest apps/sidecar/tests/` | Sidecar suite standalone (health, STT WS, scoring, TTS, generation) |

CI (`.github/workflows/ci.yml`) runs: frozen install → tokens drift check (`generate + git diff --exit-code`) → typecheck → hex-gate → `pnpm test`.

## Project structure

```text
apps/desktop/src/  renderer + main: stt/, content/, practice/, freetalk/,
                    scoring/, srs/, models/, proofs/, components/
apps/desktop/scripts/  generate-tokens.mjs, hex-gate.mjs
apps/desktop/generated/  tokens.css + tokens.ts (generated, never hand-edit)
apps/desktop/tests/  node:test suites per seam
apps/sidecar/  main.py, stt.py, scoring.py, tts.py, content_gen.py, tests/
content/  phrases_100.json, prompts_30.json, minimal_pairs.json
docs/  adr/, design-system/, gdp-ts/, packaging/, agents/
```

## Docs map

- `GLOSSARY.md` — domain vocabulary (Attempt, Reference, Transcript, Prompt, scores, packs, drills).
- `docs/adr/` — architecture decisions; contradicting one must be flagged explicitly.
- `docs/design-system/` — tokens source of truth, layering, `Button.mdx` contract.
- `docs/gdp-ts/` — lifecycle proofs recipe and breadcrumb rule.
- `docs/packaging/` — installer notes (NSIS, no bundled models, updater).
- `docs/roadmap-practice-formats.md` — MVP vs v2/v3 formats and scoring thresholds.
- `llms.txt` — AI-readable entry map to the design system.

## Packaging

`apps/desktop/package.json` (`build` key) configures electron-builder NSIS (per-user, non-one-click) excluding model weights (`!**/models/**`, `*.pt/bin/onnx`) and bundling `content/*.json`. First-run model download happens in-app; `electron-updater` checks the configured feed on start.

## Troubleshooting

- `401 invalid sidecar token`: `SIDECAR_TOKEN` must match between the sidecar process and the Electron main process. In manual runs, export the same value in both terminals.
- `Port in use`: override with `SIDECAR_PORT=<free-port>` in both processes.
- `faster-whisper` / Piper missing: the app runs with honest offline stubs (transcript/TTS tone, template content) and labels them; install the real tools for production quality.
- Ollama unreachable: `/content/generate` falls back to deterministic template items so flows stay demoable offline.
- Electron won't open in containers/SSH: no display server — run `pnpm build` + tests instead, and use a real desktop for `pnpm dev`.
