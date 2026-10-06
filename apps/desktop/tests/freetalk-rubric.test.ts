// Seam (b): Free-talk soft rubric — keyword recall, TTR, CEFR hints.
// Glossary: Prompt (cue-card text), Transcript (what STT heard),
// Fluency Stats (WPM, pause ratio, filler rate). No hard grade: the rubric
// never returns a score number.
// RED: fails until apps/desktop/src/freetalk/rubric.ts exists.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  cefrHints,
  keywordRecall,
  typeTokenRatio,
} from "../src/freetalk/rubric.ts";

test("keyword recall hits Prompt content words in the Transcript", () => {
  // Independent literal: instruction verbs + stopwords ("describe", "your")
  // are not keywords; keywords are "favorite" and "food", both recalled.
  const result = keywordRecall(
    "Describe your favorite food.",
    "My favorite food is pizza and pasta.",
  );
  assert.deepEqual(result.keywords, ["favorite", "food"]);
  assert.deepEqual(result.hits, ["favorite", "food"]);
  assert.equal(result.recall, 100);
});

test("keyword recall reports partial coverage", () => {
  const result = keywordRecall(
    "Talk about your morning routine.",
    "My family is big and kind.",
  );
  assert.deepEqual(result.keywords, ["morning", "routine"]);
  assert.deepEqual(result.hits, []);
  assert.equal(result.recall, 0);
});

test("TTR is types over tokens", () => {
  // Independent literal: 8 tokens, 5 types (the, cat, sat, on, mat).
  const ttr = typeTokenRatio("the cat sat on the mat the cat");
  assert.ok(Math.abs(ttr - 5 / 8) < 1e-9);
});

test("TTR of empty Transcript is 0", () => {
  assert.equal(typeTokenRatio(""), 0);
});

test("short simple Transcript hints A1, never a numeric score", () => {
  const rubric = cefrHints("I like cats. Cats are nice. I play with cats.");
  assert.equal(rubric.bandHint, "A1");
  assert.ok(rubric.hints.length > 0);
  assert.ok(!("score" in rubric));
});

test("longer Transcript with subordination hints B1", () => {
  const rubric = cefrHints(
    "Although I was tired, I continued practicing because I want to improve " +
      "my pronunciation, which has always been difficult for me.",
  );
  assert.equal(rubric.bandHint, "B1");
  assert.ok(rubric.hints.length > 0);
});
