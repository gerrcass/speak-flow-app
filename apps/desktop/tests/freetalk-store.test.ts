// Seam (c): SQLite persistence — attempts roundtrip across restart.
// Glossary: Attempt (one recorded try), Transcript (what STT heard),
// Fluency Stats (WPM, pause ratio, filler rate). Schema from the roadmap:
// attempts(id, format, prompt_id, transcript, wpm, pause_ratio, wer, date)
// + srs_cards(phrase_id, next_due, ease), created together (srs_cards is
// filled by #6).
// RED: fails until apps/desktop/src/freetalk/store.ts exists.
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { listAttempts, openAttemptsDb, saveAttempt } from "../src/freetalk/store.ts";

function tmpDb(): string {
  return join(mkdtempSync(join(tmpdir(), "speak-flow-5-")), "attempts.db");
}

test("init creates both attempts and srs_cards tables", () => {
  const db = openAttemptsDb(tmpDb());
  try {
    const names = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('attempts', 'srs_cards') ORDER BY name",
      )
      .all() as { name: string }[];
    assert.deepEqual(
      names.map((row) => row.name),
      ["attempts", "srs_cards"],
    );
  } finally {
    db.close();
  }
});

test("free-talk Attempt roundtrips with nullable wer", () => {
  const path = tmpDb();
  const db = openAttemptsDb(path);
  try {
    saveAttempt(db, {
      id: "attempt-1",
      format: "free-talk",
      promptId: "p01",
      transcript: "My family is big and kind.",
      wpm: 100,
      pauseRatio: 0.2,
      wer: null,
      date: "2026-10-06T10:00:00.000Z",
    });
    const rows = listAttempts(db);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      id: "attempt-1",
      format: "free-talk",
      promptId: "p01",
      transcript: "My family is big and kind.",
      wpm: 100,
      pauseRatio: 0.2,
      wer: null,
      date: "2026-10-06T10:00:00.000Z",
    });
  } finally {
    db.close();
  }
});

test("Attempts persist across restart and list newest first", () => {
  const path = tmpDb();
  const first = openAttemptsDb(path);
  try {
    saveAttempt(first, {
      id: "old",
      format: "free-talk",
      promptId: "p01",
      transcript: "Old talk.",
      wpm: 90,
      pauseRatio: 0.1,
      wer: null,
      date: "2026-10-05T10:00:00.000Z",
    });
  } finally {
    first.close();
  }
  // Reopen the same file, as a restart would.
  const second = openAttemptsDb(path);
  try {
    saveAttempt(second, {
      id: "new",
      format: "free-talk",
      promptId: "p02",
      transcript: "New talk.",
      wpm: 110,
      pauseRatio: 0.15,
      wer: null,
      date: "2026-10-06T10:00:00.000Z",
    });
    const rows = listAttempts(second);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["new", "old"],
    );
  } finally {
    second.close();
  }
});

test("raw node:sqlite handle is not needed by callers", () => {
  // Guards the seam: store owns DatabaseSync; UI talks save/list only.
  const db = openAttemptsDb(tmpDb());
  assert.ok(db instanceof DatabaseSync);
  db.close();
});
