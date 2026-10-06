// STT capture helpers (ticket #2, seam b): 16kHz mono PCM for the local
// faster-whisper sidecar, plus the WS message contract. Pure functions so
// node:test covers them without a browser or microphone.

export const STT_SAMPLE_RATE = 16000;

export function resampleTo16k(samples: Float32Array, fromRate: number): Float32Array {
  if (samples.length === 0) return new Float32Array(0);
  if (fromRate === STT_SAMPLE_RATE) return Float32Array.from(samples);
  const outLength = Math.max(1, Math.round((samples.length * STT_SAMPLE_RATE) / fromRate));
  const out = new Float32Array(outLength);
  const step = fromRate / STT_SAMPLE_RATE;
  for (let i = 0; i < outLength; i += 1) {
    const pos = i * step;
    const index = Math.floor(pos);
    const frac = pos - index;
    const a = samples[Math.min(index, samples.length - 1)];
    const b = samples[Math.min(index + 1, samples.length - 1)];
    out[i] = a + (b - a) * frac;
  }
  return out;
}

export function floatToPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    out[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
  }
  return out;
}

export function sttStreamUrl(port: number, token: string): string {
  return `ws://127.0.0.1:${port}/stt/stream?token=${encodeURIComponent(token)}`;
}

export type SttMessage =
  | { type: "partial"; text: string }
  | { type: "final"; text: string }
  | { type: "download-progress"; pct: number };

export function parseSttMessage(raw: string): SttMessage {
  const parsed = JSON.parse(raw) as { type?: unknown; text?: unknown; pct?: unknown };
  if (parsed.type === "partial" && typeof parsed.text === "string") {
    return { type: "partial", text: parsed.text };
  }
  if (parsed.type === "final" && typeof parsed.text === "string") {
    return { type: "final", text: parsed.text };
  }
  if (parsed.type === "download-progress" && typeof parsed.pct === "number") {
    return { type: "download-progress", pct: parsed.pct };
  }
  throw new Error(`unknown STT message: ${raw}`);
}
