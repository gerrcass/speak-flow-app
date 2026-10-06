// Seam (c): scoreAttempt demands an AttemptTranscribed proof about the exact
// Attempt (ADR-0005). Only the STT finish handler mints, via
// withTranscribedAttempt. Glossary: Attempt, Transcript, Pronunciation Score.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  withTranscribedAttempt,
} from "../src/proofs/attempt-transcribed.ts";
import { scoreAttempt } from "../src/scoring/attempt.ts";

test("scoreAttempt scores a transcribed Attempt with its proof", () => {
  const result = withTranscribedAttempt(
    { id: "a1", reference: "the cat sat", audioMs: 3000 },
    "the dog sat",
    (attempt, proof) => scoreAttempt(attempt, proof),
  );
  assert.equal(result?.score, 67);
  assert.deepEqual(result?.failed, ["cat"]);
  assert.equal(result?.transcript, "the dog sat");
});

test("scoreAttempt rejects a forged proof at runtime", () => {
  assert.throws(
    () =>
      withTranscribedAttempt(
        { id: "a1", reference: "the cat sat", audioMs: 3000 },
        "the cat sat",
        (attempt, proof) =>
          scoreAttempt(attempt, {
            kind: "SomethingElse",
          } as unknown as typeof proof),
      ),
    /AttemptTranscribed/,
  );
});

test("empty Transcript never mints: withTranscribedAttempt returns null", () => {
  const result = withTranscribedAttempt(
    { id: "a1", reference: "the cat sat", audioMs: 3000 },
    "   ",
    () => "should-not-run",
  );
  assert.equal(result, null);
});
