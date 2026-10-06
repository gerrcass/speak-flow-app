// Trusted minter for DrillQualified (ADR-0005). This module is the ONLY
// place that can mint the proof: the Drill scheduler calls
// withQualifiedDrill, which names the Attempt outcome and mints a proof
// about that exact value, both scoped to the callback. A Drill qualifies
// when WER > 30% OR the same word failed 2x (fail counts merge prior
// Attempts with the current failed words). Low-WER first-time misses mint
// nothing (returns null), so promoteToSrs cannot fill the SRS queue with
// noise.
//
// Breadcrumb: DrillQualified → minted here by withQualifiedDrill after the
// WER/2x-fail check → demanded by promoteToSrs → why not just an `if`: the
// compiler rejects SRS inserts for unqualified Attempts instead of hoping
// a guard ran elsewhere.
import { defineProof, name, type Named, type Proof } from "@gdp-ts/core";

const DrillQualifiedProver = defineProof("DrillQualified");

export interface DrillQualified<N> extends Proof<"DrillQualified", [N]> {}

/** Glossary: Attempt (one recorded try). WER is a percentage. */
export interface DrillOutcome {
  attemptId: string;
  /** WER percentage: qualifies the Drill when over 30. */
  wer: number;
  /** Reference words missed in this Attempt. */
  failed: string[];
  /** Miss counts from earlier Attempts, by word. */
  priorCounts: Record<string, number>;
}

export interface QualifiedDrill extends DrillOutcome {
  counts: Record<string, number>;
}

function mergeCounts(outcome: DrillOutcome): Record<string, number> {
  const counts: Record<string, number> = { ...outcome.priorCounts };
  for (const word of outcome.failed) {
    counts[word] = (counts[word] ?? 0) + 1;
  }
  return counts;
}

// The Drill scheduler and only minter. Names the qualified outcome and
// mints the proof inside the callback scope. Returns null when the Attempt
// does not qualify (low WER, no twice-failed word).
export function withQualifiedDrill<R>(
  outcome: DrillOutcome,
  use: <N>(named: Named<N, QualifiedDrill>, proof: DrillQualified<N>) => R,
): R | null {
  const counts = mergeCounts(outcome);
  const repeated = Object.values(counts).some((count) => count >= 2);
  if (!(outcome.wer > 30 || repeated)) return null;
  const qualified: QualifiedDrill = { ...outcome, counts };
  return name(qualified, (named) => use(named, DrillQualifiedProver.prove(named)));
}
