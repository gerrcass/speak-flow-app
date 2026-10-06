// Seam (b): 16kHz mono capture helpers + WS message contract for the STT panel.
// RED test: fails until apps/desktop/src/stt/audio.ts exists.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  floatToPcm16,
  parseSttMessage,
  resampleTo16k,
  sttStreamUrl,
} from "../src/stt/audio.ts";

test("resampleTo16k downsamples 48kHz mono to 16kHz", () => {
  const input = new Float32Array(480).fill(1);
  const output = resampleTo16k(input, 48000);
  assert.equal(output.length, 160);
  assert.ok(output.every((sample) => Math.abs(sample - 1) < 1e-6));
});

test("resampleTo16k keeps 16kHz input length", () => {
  const input = new Float32Array(160).fill(0.5);
  assert.equal(resampleTo16k(input, 16000).length, 160);
});

test("resampleTo16k handles empty input", () => {
  assert.equal(resampleTo16k(new Float32Array(0), 48000).length, 0);
});

test("floatToPcm16 converts and clips", () => {
  assert.deepEqual(
    Array.from(floatToPcm16(new Float32Array([1, -1, 0, 0.5, 2, -2]))),
    [32767, -32768, 0, 16384, 32767, -32768],
  );
});

test("stt stream URL stays on loopback with token query", () => {
  assert.equal(
    sttStreamUrl(4317, "secret"),
    "ws://127.0.0.1:4317/stt/stream?token=secret",
  );
});

test("parses partial, final and download-progress messages", () => {
  assert.deepEqual(parseSttMessage('{"type":"partial","text":"hel"}'), {
    type: "partial",
    text: "hel",
  });
  assert.deepEqual(parseSttMessage('{"type":"final","text":"hello"}'), {
    type: "final",
    text: "hello",
  });
  assert.deepEqual(parseSttMessage('{"type":"download-progress","pct":50}'), {
    type: "download-progress",
    pct: 50,
  });
});

test("rejects unknown STT message types", () => {
  assert.throws(() => parseSttMessage('{"type":"score","text":"x"}'));
});
