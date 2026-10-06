// Seam (a): Free-talk timer — 45/60/90s countdown with auto-stop.
// Glossary: Free-talk (speak from a cue-card Prompt against a timer).
// RED: fails until apps/desktop/src/freetalk/timer.ts exists.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  FREE_TALK_DURATIONS,
  durationMs,
  isTimeUp,
  remainingMs,
} from "../src/freetalk/timer.ts";

test("only 45/60/90s durations are offered", () => {
  assert.deepEqual([...FREE_TALK_DURATIONS], ["45", "60", "90"]);
});

test("duration converts to milliseconds", () => {
  assert.equal(durationMs("45"), 45000);
  assert.equal(durationMs("60"), 60000);
  assert.equal(durationMs("90"), 90000);
});

test("remaining counts down from the selected duration", () => {
  // Independent literal: 60s selected, 10s elapsed → 50s left.
  assert.equal(remainingMs("60", 10000), 50000);
});

test("elapsed past the duration clamps at zero and reports time-up", () => {
  assert.equal(remainingMs("45", 46000), 0);
  assert.equal(isTimeUp("45", 44999), false);
  assert.equal(isTimeUp("45", 45000), true);
});
