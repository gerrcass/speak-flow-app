// Seam (b): 7-day intelligibility trend + stable WPM summary.
// Glossary: Pronunciation Score (100-WER), Fluency Stats (WPM), Attempt.
// Intelligibility per day = avg(100-WER) over scored Attempts that day
// (Free-talk Attempts carry no WER and are skipped). WPM summary = avg WPM
// over all Attempts plus a variance note.
// RED: fails until src/freetalk/trend.ts exists.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dailyTrend, wpmSummary, type TrendDay } from "../src/freetalk/trend.ts";
import type { AttemptRow } from "../src/freetalk/store.ts";

function row(id: string, date: string, wer: number | null, wpm: number): AttemptRow {
  return {
    id,
    format: wer === null ? "free-talk" : "repeat-after-me",
    promptId: "p01",
    transcript: "Some practice speech.",
    wpm,
    pauseRatio: 0.2,
    wer,
    date,
  };
}

test("daily trend averages 100-WER per day over the last 7 days", () => {
  const attempts = [
    row("a1", "2026-10-06T10:00:00.000Z", 20, 100), // score 80
    row("a2", "2026-10-06T12:00:00.000Z", 40, 90), // score 60 → day avg 70
    row("a3", "2026-10-04T10:00:00.000Z", 10, 110), // score 90
  ];
  const trend: TrendDay[] = dailyTrend(attempts, "2026-10-06T23:00:00.000Z", 7);
  assert.equal(trend.length, 7);
  assert.equal(trend[6].date, "2026-10-06");
  assert.equal(trend[6].intelligibility, 70);
  assert.equal(trend[4].date, "2026-10-04");
  assert.equal(trend[4].intelligibility, 90);
  assert.equal(trend[5].intelligibility, null);
});

test("free-talk Attempts without WER do not move the trend", () => {
  const attempts = [row("f1", "2026-10-06T10:00:00.000Z", null, 100)];
  const trend = dailyTrend(attempts, "2026-10-06T23:00:00.000Z", 7);
  assert.equal(trend[6].intelligibility, null);
});

test("WPM summary reports the average with a stability note", () => {
  const attempts = [
    row("a1", "2026-10-06T10:00:00.000Z", 20, 95),
    row("a2", "2026-10-05T10:00:00.000Z", 30, 105),
  ];
  const summary = wpmSummary(attempts);
  assert.equal(summary.avg, 100);
  assert.match(summary.note, /stable/);
});

test("WPM summary flags wide variance", () => {
  const attempts = [
    row("a1", "2026-10-06T10:00:00.000Z", 20, 60),
    row("a2", "2026-10-05T10:00:00.000Z", 30, 140),
  ];
  const summary = wpmSummary(attempts);
  assert.equal(summary.avg, 100);
  assert.match(summary.note, /varied/);
});
