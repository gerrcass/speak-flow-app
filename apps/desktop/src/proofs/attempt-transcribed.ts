// Trusted minter for AttemptTranscribed (ADR-0005). This module is the
// ONLY place that can mint the proof: the STT finish handler calls
// withTranscribedAttempt, which names the Attempt and mints a proof about
// that exact value, both scoped to the callback. Empty Transcripts never
// mint (returns null), so scoreAttempt cannot run on untranscribed audio.
//
// Breadcrumb: AttemptTranscribed → minted here by withTranscribedAttempt
// after a non-empty Transcript check → demanded by scoreAttempt → why not
// just an `if`: the compiler rejects scoring untranscribed Attempts instead
// of hoping a guard ran elsewhere.
import { defineProof, name, type Named, type Proof } from "@gdp-ts/core";

const AttemptTranscribedProver = defineProof("AttemptTranscribed");

export interface AttemptTranscribed<N> extends Proof<"AttemptTranscribed", [N]> {}

export interface AttemptInput {
  id: string;
  reference: string;
  audioMs: number;
}

export interface TranscribedAttempt extends AttemptInput {
  transcript: string;
}

// The STT finish handler and only minter. Rejects empty Transcripts with
// null (no proof exists for silence), otherwise names the transcribed
// Attempt and mints the proof inside the callback scope.
export function withTranscribedAttempt<R>(
  attempt: AttemptInput,
  transcript: string,
  use: <N>(
    named: Named<N, TranscribedAttempt>,
    proof: AttemptTranscribed<N>,
  ) => R,
): R | null {
  if (transcript.trim() === "") return null;
  const transcribed: TranscribedAttempt = { ...attempt, transcript };
  return name(transcribed, (named) =>
    use(named, AttemptTranscribedProver.prove(named)),
  );
}
