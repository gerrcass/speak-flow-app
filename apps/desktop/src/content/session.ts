// Practice sessions (ticket #3). Glossary: Attempt, Reference, Prompt.
// Sensitive function: startSession demands a ContentPackVerified proof about
// the exact pack value, so practicing with a corrupt or AI-hallucinated pack
// is a compile error, not a forgotten `if`.
import type { Named } from "@gdp-ts/core";
import type { ContentPack } from "./pack.ts";
import type { ContentPackVerified } from "../proofs/content-pack-verified.ts";

export interface PracticeSession {
  id: string;
  packId: string;
  kind: ContentPack["kind"];
  items: number;
  startedAt: string;
}

export function startSession<N>(
  pack: Named<N, ContentPack>,
  proof: ContentPackVerified<N>,
): PracticeSession {
  if (proof?.kind !== "ContentPackVerified") {
    throw new Error("startSession demands a ContentPackVerified proof for this pack");
  }
  const value = pack.value;
  return {
    id: `session-${value.id}-${Date.now()}`,
    packId: value.id,
    kind: value.kind,
    items: value.items.length,
    startedAt: new Date().toISOString(),
  };
}
