// Trusted minter for ContentPackVerified (ADR-0005). This module is the
// ONLY place that can mint the proof: the pack loader lives here, in
// proofs/, next to the prover it owns. The prover itself is never exported,
// so no other module can forge a proof without an `as` cast (banned by the
// gdp-ts lint preset). See docs/gdp-ts/README.md.
//
// Breadcrumb: ContentPackVerified → minted here by withVerifiedPack after
// zod schema + level-tag check → demanded by startSession → why not just an
// `if`: the compiler rejects practicing with unverified packs instead of
// hoping a guard ran elsewhere.
import { defineProof, name, type Named, type Proof } from "@gdp-ts/core";
import { ContentPackSchema, type ContentPack } from "../content/pack.ts";

const ContentPackVerifiedProver = defineProof("ContentPackVerified");

export interface ContentPackVerified<N> extends Proof<"ContentPackVerified", [N]> {}

// The pack loader and only minter. Validates the raw value, then names the
// parsed Content Pack and mints a proof about that exact value, both scoped
// to the callback (gdp-ts names and proofs cannot escape it). Returns null
// when the pack fails the schema + level-tag check, so no proof exists for
// invalid packs. Sensitive work (startSession) happens inside `use`.
export function withVerifiedPack<R>(
  raw: unknown,
  use: <N>(pack: Named<N, ContentPack>, proof: ContentPackVerified<N>) => R,
): R | null {
  const parsed = ContentPackSchema.safeParse(raw);
  if (!parsed.success) return null;
  return name(parsed.data, (named) => use(named, ContentPackVerifiedProver.prove(named)));
}

// Manual paste-import (day-one path): textarea text → validated Content Pack
// value for listing. Session start re-verifies through withVerifiedPack, so
// a pack mutated after listing cannot ride an old check into a session.
export function importPastedPack(text: string): ContentPack | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = ContentPackSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
}
