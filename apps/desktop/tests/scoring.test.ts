// Seam (a): WER / Pronunciation Score + failed words; seam (b): Fluency Stats.
// Glossary: Reference, Transcript, Attempt, Pronunciation Score (100-WER +
// failed words), Fluency Stats (WPM, pause ratio, filler rate).
// RED: fails until apps/desktop/src/scoring/scoring.ts exists.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  computeFluency,
  computeWer,
  failedWords,
  pronunciationScore,
  scoreBand,
} from "../src/scoring/scoring.ts";

test("identical Reference and Transcript score 100 with no failed words", () => {
  assert.equal(computeWer("the cat sat", "the cat sat"), 0);
  assert.equal(pronunciationScore("the cat sat", "the cat sat"), 100);
  assert.deepEqual(failedWords("the cat sat", "the cat sat"), []);
});

test("one substitution in three words: WER 1/3, score rounds to 67", () => {
  // Independent literal: WER = (S+D+I)/N = 1/3 = 33.33 -> score 67.
  assert.equal(pronunciationScore("the cat sat", "the dog sat"), 67);
  assert.deepEqual(failedWords("the cat sat", "the dog sat"), ["cat"]);
});

test("tokenize is case-insensitive and ignores punctuation", () => {
  assert.equal(pronunciationScore("Hello, world!", "hello world"), 100);
});

test("empty Transcript scores 0 and flags every Reference word", () => {
  assert.equal(pronunciationScore("the cat sat", ""), 0);
  assert.deepEqual(failedWords("the cat sat", ""), ["the", "cat", "sat"]);
});

test("insertions count against the score", () => {
  // 1 insertion over 2 Reference words -> WER 50 -> score 50.
  assert.equal(pronunciationScore("go now", "go right now"), 50);
});

test("score bands follow the roadmap: >85 pass, 70-85 warn, <70 fail", () => {
  assert.equal(scoreBand(100), "pass");
  assert.equal(scoreBand(86), "pass");
  assert.equal(scoreBand(85), "warn");
  assert.equal(scoreBand(70), "warn");
  assert.equal(scoreBand(69), "fail");
});

test("fluency numbers come from known literals, not recomputation", () => {
  // 12 words in 6s of speech within a 10s Attempt -> 120 WPM,
  // pause ratio 0.4, one filler in 12 words -> 1 filler/min scale.
  const stats = computeFluency({
    transcript: "well I think um the cat sat on the mat today now",
    speechMs: 6000,
    totalMs: 10000,
  });
  assert.equal(stats.wpm, 120);
  assert.equal(stats.pauseRatio, 0.4);
  assert.equal(stats.fillerRate, 10);
  assert.deepEqual(stats.fillers, ["um"]);
});

test("fluency handles silence-only attempts without NaN", () => {
  const stats = computeFluency({ transcript: "", speechMs: 0, totalMs: 5000 });
  assert.equal(stats.wpm, 0);
  assert.equal(stats.pauseRatio, 1);
  assert.equal(stats.fillerRate, 0);
});
