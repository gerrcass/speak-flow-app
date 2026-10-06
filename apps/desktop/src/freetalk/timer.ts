// Free-talk timer (ticket #5). Pure countdown helpers; the panel owns the
// clock and auto-stops recording when isTimeUp turns true.
// Glossary: Free-talk (speak from a cue-card Prompt against a timer).

/** Closed union of offered Free-talk durations, in seconds. */
export type FreeTalkDuration = "45" | "60" | "90";

export const FREE_TALK_DURATIONS: readonly FreeTalkDuration[] = ["45", "60", "90"];

/** Selected duration in milliseconds. */
export function durationMs(duration: FreeTalkDuration): number {
  return Number(duration) * 1000;
}

/** Milliseconds left after elapsedMs, clamped at zero. */
export function remainingMs(duration: FreeTalkDuration, elapsedMs: number): number {
  return Math.max(0, durationMs(duration) - elapsedMs);
}

/** True once the selected duration has fully elapsed (auto-stop point). */
export function isTimeUp(duration: FreeTalkDuration, elapsedMs: number): boolean {
  return elapsedMs >= durationMs(duration);
}
