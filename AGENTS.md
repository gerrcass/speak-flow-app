# speak-flow-app

Local-first Windows desktop app for English speaking practice. Electron + React TS frontend, Python FastAPI sidecar on `127.0.0.1` for STT/scoring/TTS. Offline by default, no paid API required.

## Build from here

Naming a domain concept: read `GLOSSARY.md` first and use its terms (`Attempt`, `Reference`, `Transcript`, `Prompt`, `Pronunciation Score`, `Fluency Stats`, `Content Pack`, `Drill`). Covers speaking-only MVP vocabulary.

Scoping practice work: MVP is Repeat-after-me + Read-Aloud + Free-talk only. See `docs/roadmap-practice-formats.md` for v2/v3 (ludic, shadowing, role-play) — out of scope unless asked.

Respecting past decisions: read `docs/adr/` (0001 no-Handy, 0002 Electron+sidecar, 0003 shadcn+W3C tokens, 0004 local-first+BYOK, 0005 gdp-ts proofs). Contradicting one: surface it explicitly (`Contradicts ADR-000X … because …`).

Building UI: follow `docs/design-system/README.md` and `llms.txt`. Source of truth is `docs/design-system/tokens/tokens.json` (W3C `$value`/`$type`/`$description`); generate `tokens.css`/typed export, never hand-edit outputs. Copy the `Button.mdx` contract: closed unions, semantic `var(--*)` only.

Generating content: default `local` (Ollama/llama.cpp, offline). Cloud only via user-supplied BYOK in OS keychain; never bundle or commit keys. See `docs/adr/0004-local-first-generation-byok.md`.

Adding lifecycle safety: use `docs/gdp-ts/README.md`. Three proofs only (`AttemptTranscribed`, `ContentPackVerified`, `DrillQualified`) in `apps/desktop/src/proofs/`; keep the lint preset green.

## Working agreements

English everywhere: repo, code, docs, issues.

Reach for semantic tokens, closed prop unions, and SQLite `attempts`/`srs_cards` from day one. Leave a one-line crumb in the relevant `docs/` README per decision while building; keep sessions demoable per ticket.

## Agent skills

### Issue tracker

Issues live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (root `GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.
