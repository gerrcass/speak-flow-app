// Sensitive function: scoreAttempt demands an AttemptTranscribed proof
// about the exact Attempt (ADR-0005). Type + runtime guard both check the
// proof kind, so a forged or missing proof is a compile error and a
// runtime throw. Glossary: Attempt, Transcript, Pronunciation Score,
// Fluency Stats.
import type { Named } from "@gdp-ts/core";
import type {
  AttemptTranscribed,
  TranscribedAttempt,
} from "../proofs/attempt-transcribed.ts";
import {
  computeFluency,
  failedWords,
  pronunciationScore,
  scoreBand,
  type FluencyStats,
  type ScoreBand,
} from "./scoring.ts";

export interface AttemptResult {
  attemptId: string;
  transcript: string;
  score: number;
  band: ScoreBand;
  failed: string[];
  fluency: FluencyStats;
}

export function scoreAttempt<N>(
  attempt: Named<N, TranscribedAttempt>,
  proof: AttemptTranscribed<N>,
): AttemptResult {
  if (proof?.kind !== "AttemptTranscribed") {
    throw new Error("scoreAttempt demands an AttemptTranscribed proof for this Attempt");
  }
  const value = attempt.value;
  return {
    attemptId: value.id,
    transcript: value.transcript,
    score: pronunciationScore(value.reference, value.transcript),
    band: scoreBand(pronunciationScore(value.reference, value.transcript)),
    failed: failedWords(value.reference, value.transcript),
    // No VAD wired yet: speech and total share audioMs, so pauseRatio is 0
    // (honest placeholder, not measured silence).
    fluency: computeFluency({
      transcript: value.transcript,
      speechMs: value.audioMs,
      totalMs: value.audioMs,
    }),
  };
}
