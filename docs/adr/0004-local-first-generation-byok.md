# 0004 Local-first content generation with optional BYOK, never bundled keys

Content Packs need fresh References and Prompts. Default is local inference, fully offline and free (Ollama / llama.cpp with a small model such as Llama 3.1 8B Q4 or Phi-3, prompted with CEFR level + focus tags). Cloud is opt-in only via BYOK: the end user pastes their own provider key, stored in the OS keychain via Electron `safeStorage`, never in source or bundled with the installer.

Correction to an easy mistake: an OpenCode Zen API key (https://opencode.ai/docs/zen) is a pay-as-you-go gateway for the coding agent in the dev environment. It must not be shipped inside the desktop app. Shipping it would leak the key, bill all end-user usage to the developer, and break the offline promise. Dev keys stay in dev (`.env` ignored, `opencode auth` only). App keys are per-user BYOK or no key at all (local).

## Consequences

- Sidecar exposes `POST /content/generate` with provider `local | byok`, default `local`.
- No `OPENCODE_API_KEY`, no provider key, no secret in git or in `extraResources`.
- UI shows provider badge: "Local (offline)" vs "BYOK (cloud, billed to your key)".
