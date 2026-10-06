// Seam (a): DrillQualified proof + promoteToSrs + SM-2 queue.
// Glossary: Drill (scheduled retry of a failed phrase), Attempt (one
// recorded try), Pronunciation Score (100-WER + failed words).
// ADR-0005: promoteToSrs demands DrillQualified (WER > 30% or 2x failed
// word). SM-2 simplified: intervals 1d/3d/7d, ease 2.5 default.
// RED: fails until proofs/drill-qualified.ts + srs/cards.ts exist.
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openAttemptsDb } from "../src/freetalk/store.ts";
import { withQualifiedDrill } from "../src/proofs/drill-qualified.ts";
import { listDueCards, nextIntervalDays, promoteToSrs } from "../src/srs/cards.ts";

function tmpDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "speak-flow-6-")), "attempts.db");
}

test("DrillQualified mints when WER is over 30", () => {
  const minted = withQualifiedDrill(
    { attemptId: "a1", wer: 45, failed: ["sheet"], priorCounts: {} },
    (_named, proof) => proof.kind,
  );
  assert.equal(minted, "DrillQualified");
});

test("DrillQualified does not mint on low WER with no repeated word", () => {
  const minted = withQualifiedDrill(
    { attemptId: "a2", wer: 10, failed: ["ship"], priorCounts: {} },
    () => "minted",
  );
  assert.equal(minted, null);
});

test("DrillQualified mints when the same word failed twice", () => {
  const minted = withQualifiedDrill(
    { attemptId: "a3", wer: 10, failed: ["sheet"], priorCounts: { sheet: 1 } },
    (_named, proof) => proof.kind,
  );
  assert.equal(minted, "DrillQualified");
});

test("promoteToSrs rejects a forged proof", () => {
  const db = openAttemptsDb(tmpDbPath());
  try {
    assert.throws(
      () =>
        promoteToSrs(
          db,
          { phraseId: "sheet", now: "2026-10-06T10:00:00.000Z" },
          { kind: "Forged" } as never,
        ),
      /DrillQualified/,
    );
  } finally {
    db.close();
  }
});

test("SM-2 intervals progress 1d then 3d then 7d", () => {
  assert.equal(nextIntervalDays(0), 1);
  assert.equal(nextIntervalDays(1), 3);
  assert.equal(nextIntervalDays(2), 7);
  assert.equal(nextIntervalDays(9), 7);
});

test("promoteToSrs inserts a card due in 1 day with ease 2.5", () => {
  const db = openAttemptsDb(tmpDbPath());
  try {
    withQualifiedDrill(
      { attemptId: "a4", wer: 60, failed: ["sheet"], priorCounts: {} },
      (_named, proof) => {
        promoteToSrs(db, { phraseId: "sheet", now: "2026-10-06T10:00:00.000Z" }, proof);
      },
    );
    const due = listDueCards(db, "2026-10-07T10:00:00.000Z");
    assert.equal(due.length, 1);
    assert.equal(due[0].phraseId, "sheet");
    assert.equal(due[0].nextDue, "2026-10-07T10:00:00.000Z");
    assert.equal(due[0].ease, 2.5);
    // Not due before the interval elapses.
    assert.equal(listDueCards(db, "2026-10-06T10:00:01.000Z").length, 0);
  } finally {
    db.close();
  }
});

test("promoteToSrs advances the interval to 3d then 7d on re-promotion", () => {
  const db = openAttemptsDb(tmpDbPath());
  try {
    // Proofs cannot escape withQualifiedDrill: the sensitive call happens
    // inside `use`, exactly as production code must do.
    const promote = (id: string, now: string) =>
      withQualifiedDrill(
        { attemptId: id, wer: 60, failed: ["ship"], priorCounts: {} },
        (_named, proof) => promoteToSrs(db, { phraseId: "ship", now }, proof),
      );
    promote("b1", "2026-10-06T10:00:00.000Z");
    promote("b2", "2026-10-07T10:00:00.000Z");
    const due = listDueCards(db, "2026-10-10T10:00:00.000Z");
    assert.equal(due.length, 1);
    assert.equal(due[0].nextDue, "2026-10-10T10:00:00.000Z");
  } finally {
    db.close();
  }
});
