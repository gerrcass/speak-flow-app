// Scoring for Repeat-after-me + Read-Aloud (ticket #4).
// Glossary: Reference (exact expected text), Transcript (what STT heard),
// Attempt (one recorded try), Pronunciation Score (100-WER + failed words),
// Fluency Stats (WPM, pause ratio, filler rate).
//
// Pure functions only. No hex, no primitive token names: the UI maps bands
// to semantic var(--color-feedback-*) tokens.

export type ScoreBand = "pass" | "warn" | "fail";

export interface FluencyStats {
  wpm: number;
  pauseRatio: number;
  fillerRate: number;
  fillers: string[];
}

const FILLERS = new Set(["um", "uh", "er", "ah", "hmm", "eh", "mm"]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((word) => word !== "");
}

function levenshteinWords(ref: string[], hyp: string[]): number {
  const prev = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= hyp.length; j += 1) {
      const temp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (ref[i - 1] === hyp[j - 1] ? 0 : 1),
      );
      diag = temp;
    }
  }
  return prev[hyp.length];
}

/** WER percentage: 100 * edits / Reference words. Empty Reference → 0 or 100. */
export function computeWer(reference: string, transcript: string): number {
  const ref = tokenize(reference);
  const hyp = tokenize(transcript);
  if (ref.length === 0) return hyp.length === 0 ? 0 : 100;
  return (levenshteinWords(ref, hyp) / ref.length) * 100;
}

/** Pronunciation Score: max(0, round(100 - WER)). */
export function pronunciationScore(reference: string, transcript: string): number {
  return Math.max(0, Math.round(100 - computeWer(reference, transcript)));
}

/** Reference words the learner missed, via Levenshtein alignment backtrack. */
export function failedWords(reference: string, transcript: string): string[] {
  const ref = tokenize(reference);
  const hyp = tokenize(transcript);
  const rows = ref.length + 1;
  const cols = hyp.length + 1;
  const dp: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1),
      );
    }
  }
  const failed: string[] = [];
  let i = ref.length;
  let j = hyp.length;
  while (i > 0) {
    if (j > 0 && ref[i - 1] === hyp[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      i -= 1;
      j -= 1;
    } else if (j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1 && ref[i - 1] !== hyp[j - 1]) {
      failed.unshift(ref[i - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      failed.unshift(ref[i - 1]);
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return failed;
}

/** Roadmap bands: >85 pass, 70-85 warn, <70 fail. */
export function scoreBand(score: number): ScoreBand {
  if (score > 85) return "pass";
  if (score >= 70) return "warn";
  return "fail";
}

export interface FluencyInput {
  transcript: string;
  speechMs: number;
  totalMs: number;
}

/** Fluency Stats from Transcript + VAD-style durations. Filler rate is per minute of speech. */
export function computeFluency(input: FluencyInput): FluencyStats {
  const words = tokenize(input.transcript);
  const minutes = input.speechMs / 60000;
  const fillers = words.filter((word) => FILLERS.has(word));
  return {
    wpm: input.speechMs > 0 ? Math.round(words.length / minutes) : 0,
    pauseRatio: input.totalMs > 0 ? 1 - input.speechMs / input.totalMs : 1,
    fillerRate: minutes > 0 ? fillers.length / minutes : 0,
    fillers,
  };
}
