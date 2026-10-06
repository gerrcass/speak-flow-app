// SQLite persistence for Free-talk Attempts (ticket #5), via node:sqlite
// (built into Node 22: no native dependency to fetch offline).
// Glossary: Attempt (one recorded try), Transcript (what STT heard).
// Schema from the roadmap: attempts(id, format, prompt_id, transcript,
// wpm, pause_ratio, wer, date) + srs_cards(phrase_id, next_due, ease).
// Both tables are created now; srs_cards stays empty until #6.
import { DatabaseSync } from "node:sqlite";

export type AttemptFormat = "free-talk" | "repeat-after-me" | "read-aloud";

export interface AttemptRow {
  id: string;
  format: AttemptFormat;
  promptId: string;
  transcript: string;
  wpm: number;
  pauseRatio: number;
  /** WER is null for Free-talk: no Reference exists to compare against. */
  wer: number | null;
  date: string;
}

/** Open (creating if needed) the attempts DB and ensure both tables exist. */
export function openAttemptsDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS attempts(
      id TEXT PRIMARY KEY,
      format TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      transcript TEXT NOT NULL,
      wpm REAL NOT NULL,
      pause_ratio REAL NOT NULL,
      wer REAL,
      date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS srs_cards(
      phrase_id TEXT PRIMARY KEY,
      next_due TEXT NOT NULL,
      ease REAL NOT NULL
    );
  `);
  // Ticket #6: promotion count drives the SM-2 1d/3d/7d progression.
  // ALTER is a no-op when the column already exists (pre-#6 databases).
  try {
    db.exec("ALTER TABLE srs_cards ADD COLUMN reps INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already present.
  }
  return db;
}

export function saveAttempt(db: DatabaseSync, row: AttemptRow): void {
  db.prepare(
    `INSERT OR REPLACE INTO attempts(id, format, prompt_id, transcript, wpm, pause_ratio, wer, date)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.format,
    row.promptId,
    row.transcript,
    row.wpm,
    row.pauseRatio,
    row.wer,
    row.date,
  );
}

/** Attempts newest first, for the history list. */
export function listAttempts(db: DatabaseSync): AttemptRow[] {
  const rows = db
    .prepare(
      "SELECT id, format, prompt_id, transcript, wpm, pause_ratio, wer, date FROM attempts ORDER BY date DESC",
    )
    .all() as {
    id: string;
    format: AttemptFormat;
    prompt_id: string;
    transcript: string;
    wpm: number;
    pause_ratio: number;
    wer: number | null;
    date: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    format: row.format,
    promptId: row.prompt_id,
    transcript: row.transcript,
    wpm: row.wpm,
    pauseRatio: row.pause_ratio,
    wer: row.wer,
    date: row.date,
  }));
}
