// Seam (b): AudioWorklet capture source ships a 16kHz mono PCM worklet.
// RED test: fails until apps/desktop/src/stt/capture.ts exists.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { captureWorkletCode, captureWorkletName } from "../src/stt/capture.ts";

test("capture worklet targets 16kHz mono PCM", () => {
  assert.ok(captureWorkletName.length > 0);
  assert.ok(captureWorkletCode.includes("16000"));
  assert.ok(captureWorkletCode.includes("postMessage"));
  assert.ok(captureWorkletCode.includes("registerProcessor"));
});
