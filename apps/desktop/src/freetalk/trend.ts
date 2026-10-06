// 7-day intelligibility trend + WPM summary (ticket #6). Pure functions
// over Attempt rows from the attempts table. Glossary: Attempt (one
// recorded try), Pronunciation Score (100-WER), Fluency Stats (WPM).
import type { AttemptRow } from "./store.ts";

export interface TrendDay {
  /** Calendar day, YYYY-MM-DD (UTC). */
  date: string;
  /** Avg(100-WER) that day, or null when no scored Attempt exists. */
  intelligibility: number | null;
}

export interface WpmSummary {
  avg: number;
  note: string;
}

function dayKey(dateIso: string): string {
  return dateIso.slice(0, 10);
}

/** Last `days` calendar days ending on `nowIso`, oldest first. */
export function dailyTrend(attempts: AttemptRow[], nowIso: string, days: number): TrendDay[] {
  const now = Date.parse(nowIso);
  const byDay = new Map<string, number[]>();
  for (const attempt of attempts) {
    if (attempt.wer === null) continue;
    const key = dayKey(attempt.date);
    const scores = byDay.get(key) ?? [];
    scores.push(100 - attempt.wer);
    byDay.set(key, scores);
  }
  const trend: TrendDay[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const date = new Date(now - back * 86400000).toISOString().slice(0, 10);
    const scores = byDay.get(date) ?? [];
    trend.push({
      date,
      intelligibility:
        scores.length === 0 ? null : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    });
  }
  return trend;
}

/** Avg WPM over all Attempts, with a variance note (roadmap: stable WPM). */
export function wpmSummary(attempts: AttemptRow[]): WpmSummary {
  if (attempts.length === 0) return { avg: 0, note: "no Attempts yet" };
  const wpms = attempts.map((attempt) => attempt.wpm);
  const avg = Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length);
  const min = Math.min(...wpms);
  const max = Math.max(...wpms);
  const note = max - min <= 20 ? `stable (${min}–${max} WPM)` : `varied (${min}–${max} WPM)`;
  return { avg, note };
}
