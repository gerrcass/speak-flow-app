// SRS queue for Drills (ticket #6). Glossary: Drill (scheduled retry of a
// failed phrase). SM-2 simplified: ease 2.5 default, interval progression
// 1d → 3d → 7d by promotion count. promoteToSrs is sensitive: it demands a
// DrillQualified proof (ADR-0005), checked both by types and at runtime.

import type { DatabaseSync } from "node:sqlite";
import type { DrillQualified } from "../proofs/drill-qualified.ts";

export const DEFAULT_EASE = 2.5;

/** SM-2 simplified: first promotion due in 1d, then 3d, then 7d. */
export function nextIntervalDays(promotions: number): number {
  if (promotions <= 0) return 1;
  if (promotions === 1) return 3;
  return 7;
}

export interface PromoteInput {
  phraseId: string;
  /** ISO timestamp the promotion happens at; next_due derives from it. */
  now: string;
}

export interface SrsCard {
  phraseId: string;
  nextDue: string;
  ease: number;
}

function dueDate(nowIso: string, days: number): string {
  return new Date(Date.parse(nowIso) + days * 86400000).toISOString();
}

function promotionCount(db: DatabaseSync, phraseId: string): number {
  const row = db
    .prepare("SELECT reps FROM srs_cards WHERE phrase_id = ?")
    .get(phraseId) as { reps: number } | undefined;
  return row?.reps ?? 0;
}

export function promoteToSrs<N>(
  db: DatabaseSync,
  input: PromoteInput,
  proof: DrillQualified<N>,
): SrsCard {
  if (proof?.kind !== "DrillQualified") {
    throw new Error("promoteToSrs demands a DrillQualified proof for this Attempt");
  }
  const reps = promotionCount(db, input.phraseId);
  const existing = db
    .prepare("SELECT ease FROM srs_cards WHERE phrase_id = ?")
    .get(input.phraseId) as { ease: number } | undefined;
  const card: SrsCard = {
    phraseId: input.phraseId,
    nextDue: dueDate(input.now, nextIntervalDays(reps)),
    ease: existing?.ease ?? DEFAULT_EASE,
  };
  db.prepare(
    `INSERT INTO srs_cards(phrase_id, next_due, ease, reps)
     VALUES(?, ?, ?, ?)
     ON CONFLICT(phrase_id) DO UPDATE SET next_due = excluded.next_due, reps = excluded.reps`,
  ).run(card.phraseId, card.nextDue, card.ease, reps + 1);
  return card;
}

/** Tricky-phrases view data: cards due at or before `now`, soonest first. */
export function listDueCards(db: DatabaseSync, now: string): SrsCard[] {
  const rows = db
    .prepare(
      "SELECT phrase_id, next_due, ease FROM srs_cards WHERE next_due <= ? ORDER BY next_due ASC",
    )
    .all(now) as { phrase_id: string; next_due: string; ease: number }[];
  return rows.map((row) => ({ phraseId: row.phrase_id, nextDue: row.next_due, ease: row.ease }));
}
