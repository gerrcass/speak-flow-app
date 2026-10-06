// History-list text shaping for Free-talk Attempts (ticket #5). Pure.
// Glossary: Transcript (what STT heard).

/** Collapse whitespace and truncate long Transcripts for the history list. */
export function snippet(transcript: string, max = 80): string {
  const flat = transcript.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}
