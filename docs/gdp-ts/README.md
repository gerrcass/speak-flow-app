# gdp-ts in speak-flow-app

> Learning trail: `gdp-ts` (https://github.com/rauchg/gdp-ts, MIT) is a tiny library +
> linter implementing Ghosts of Departed Proofs for TypeScript. It makes authorization
> bugs ("can this X do Y to this Z") compile errors instead of runtime surprises.
> This app is single-user and local-first, so there is no multi-user auth. We use
> `gdp-ts` in its second role: **lifecycle proofs** — a function cannot run unless the
> caller presents compile-time evidence about the *exact* values involved.

## The one idea (60 seconds)

Normal code passes raw ids and hopes the check happened elsewhere:

```ts
await scoreAttempt(attemptId); // did anyone verify this attempt was transcribed?
```

With gdp-ts, sensitive functions *demand a proof* about their exact arguments:

```ts
await scoreAttempt(attempt, proof: AttemptTranscribed<A>);
// no proof, wrong attempt, or forged proof => compile error
```

Proofs are ghosts: frozen `{ kind }` objects at runtime, everything at compile time.
Only one trusted module can mint each proof. Lint bans `as` forging and minting
outside `proofs/`.

## Where we use it here (and where we do not)

Use (TypeScript Electron layer only, `apps/desktop/src/proofs/`):
- `AttemptTranscribed<A>`: `scoreAttempt()` demands it. Minted once by the STT finish handler for that exact attempt. Prevents scoring empty/untranscribed audio.
- `ContentPackVerified<C>`: `startSession()` demands it. Minted by the pack loader after schema + level-tag check. Prevents practicing with corrupt/AI-hallucinated packs.
- `DrillQualified<A>`: `promoteToSrs()` demands it. Minted when WER > 30% or word failed 2x. Prevents SRS spam.
- Later (optional): `HistoryEraseConfirmed<H>` for destructive deletes.

Do NOT use for:
- Python sidecar (no TS there; plain validation).
- STT accuracy itself (gdp-ts proves *relationships between values*, not ML quality).
- Over-proving everything. Ease-to-rigor slider: 3 proofs now, more only when a real bug class appears. See `where-to-stop.md` in the skill.

## Recipe (mirrors upstream skill, scoped to this repo)

1. Brand ids (`AttemptId`, `PackId` as `string & { __brand }`).
2. One trusted module per fact in `apps/desktop/src/proofs/` (only place that can mint).
3. Policies as unions (e.g. `Scorable = AttemptTranscribed | InstructorOverride`).
4. Sensitive functions demand proofs (see examples below).
5. Name and prove in the handler (`name(id, ...)` then prove, turn `null` into UI message).
6. Turn on the lint preset (`@gdp-ts/core/lint/eslint`), which bans `{} as Proof` and cross-module minting.

Install when scaffolding the desktop app:

```sh
pnpm add @gdp-ts/core
npx skills add rauchg/gdp-ts
```

Requires TypeScript 5.4+.

## Minimal example (shape of future code, not yet scaffolded)

```ts
// proofs/attempt-transcribed.ts (trusted: only minter)
import { defineProof, type Proof } from '@gdp-ts/core';
const AttemptTranscribed = defineProof('AttemptTranscribed');
export interface AttemptTranscribed<A> extends Proof<'AttemptTranscribed', [A]> {}
```

```ts
// scoring.ts (sensitive: demands proof)
export function scoreAttempt<A>(attempt: Named<A, Attempt>, _p: AttemptTranscribed<A>) {
  // safe: this attempt was transcribed, about this exact audio
}
```

## What this does not guarantee

- Forged proofs (`as` casts) — caught by lint, not by types. Keep the lint green.
- Stale proofs (transcript edited after proof) — re-prove after mutation or make values immutable.
- No schema validation — still validate pack JSON with zod at the edge; gdp-ts proves relationships, not shapes.

## Breadcrumb rule

When adding a proof, append one bullet here: *fact → minter → demanders → why not just an `if`*. Keep it to one line each.

## Breadcrumbs

- ContentPackVerified → minted by withVerifiedPack in proofs/ after zod schema + level-tag check → demanded by startSession → compiler rejects unverified packs instead of hoping a guard ran.
