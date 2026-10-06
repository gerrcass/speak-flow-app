# 0005 Use gdp-ts lifecycle proofs in the TypeScript layer

Single-user local app with no server-side authorization, so classic multi-user auth proofs do not apply. We still adopt `gdp-ts` narrowly in `apps/desktop/src`: sensitive functions demand compile-time proofs about exact values (`AttemptTranscribed`, `ContentPackVerified`, `DrillQualified`). This catches skipped-step bugs (scoring before transcription, practicing with unverified packs, SRS spam) at type-check with ~zero runtime cost, and teaches the Ghosts of Departed Proofs pattern on a small surface.

## Considered Options

- Plain `if` guards everywhere: works but silently skippable by future code/agents; no compiler help.
- Full auth-style proofs across the app: overkill without users/roles; violates the ease-to-rigor slider.
- No gdp-ts at all: loses the learning goal and the cheapest lifecycle safety.

## Consequences

- `pnpm add @gdp-ts/core` + lint preset when scaffolding `apps/desktop`.
- Proofs live only in `apps/desktop/src/proofs/`; minting elsewhere fails lint.
- Python sidecar stays out of scope (validation only, no TS types).
