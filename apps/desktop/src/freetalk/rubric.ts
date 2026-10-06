// Free-talk soft rubric (ticket #5). Pure functions only.
// Glossary: Prompt (cue-card text), Transcript (what STT heard).
// Soft rubric only: keyword recall + TTR + CEFR hints. There is deliberately
// no hard grade and no score number anywhere in this module.
import { tokenize } from "../scoring/scoring.ts";

export type CefrBandHint = "A1" | "A2" | "B1";

// Instruction verbs and function words carry no topic signal and are never
// keywords, whatever the Prompt says.
const NON_KEYWORDS = new Set([
  "talk",
  "about",
  "your",
  "describe",
  "tell",
  "with",
  "from",
  "that",
  "this",
  "these",
  "those",
  "what",
  "when",
  "where",
  "which",
  "have",
  "with",
  "your",
  "seconds",
  "second",
  "minute",
  "minutes",
  "favourite",
]);

export interface KeywordRecall {
  keywords: string[];
  hits: string[];
  recall: number;
}

/** Prompt content words (len >= 4, deduped) and how many the Transcript recalled. */
export function keywordRecall(prompt: string, transcript: string): KeywordRecall {
  const keywords = [...new Set(tokenize(prompt))].filter(
    (word) => word.length >= 4 && !NON_KEYWORDS.has(word),
  );
  const said = new Set(tokenize(transcript));
  const hits = keywords.filter((word) => said.has(word));
  return {
    keywords,
    hits,
    recall: keywords.length === 0 ? 0 : (hits.length / keywords.length) * 100,
  };
}

/** Type-token ratio: distinct words over total words. Empty Transcript → 0. */
export function typeTokenRatio(transcript: string): number {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return 0;
  return new Set(tokens).size / tokens.length;
}

export interface CefrHintResult {
  bandHint: CefrBandHint;
  hints: string[];
}

const SUBORDINATORS = new Set([
  "although",
  "because",
  "however",
  "which",
  "while",
  "unless",
  "since",
  "therefore",
  "despite",
]);

/**
 * CEFR hints from word-length / sentence-length / subordination heuristics.
 * Labeled hints only, never a grade: short everyday sentences hint A1,
 * mixed sentences hint A2, longer sentences with subordination hint B1.
 */
export function cefrHints(transcript: string): CefrHintResult {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) {
    return { bandHint: "A1", hints: ["No speech yet: say a few short sentences."] };
  }
  const sentences = transcript
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const avgWordLen = tokens.join("").length / tokens.length;
  const avgSentLen = tokens.length / Math.max(1, sentences.length);
  const subCount = tokens.filter((word) => SUBORDINATORS.has(word)).length;

  if (subCount >= 1 && (avgSentLen >= 9 || avgWordLen >= 4.6)) {
    return {
      bandHint: "B1",
      hints: [
        "Hint: you linked ideas with subordinate words; try a longer story next.",
      ],
    };
  }
  if (avgSentLen >= 7 || avgWordLen >= 4.4 || subCount >= 1) {
    return {
      bandHint: "A2",
      hints: ["Hint: sentences are growing; add a reason with because or when."],
    };
  }
  return {
    bandHint: "A1",
    hints: ["Hint: short everyday sentences; add one detail per sentence."],
  };
}
