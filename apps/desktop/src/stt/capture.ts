// 16kHz mono mic capture (ticket #2, seam b): AudioWorklet with a
// ScriptProcessor fallback. The worklet downsamples to 16kHz in-thread and
// posts Int16 PCM; the fallback path reuses resampleTo16k/floatToPcm16.

import { STT_SAMPLE_RATE, floatToPcm16, resampleTo16k } from "./audio.ts";

export const captureWorkletName = "speak-flow-capture";

export const captureWorkletCode = `
class SpeakFlowCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frac = 0;
    this._prev = 0;
  }
  process(inputs) {
    const channel = inputs && inputs[0] && inputs[0][0];
    if (!channel) return true;
    const step = sampleRate / ${STT_SAMPLE_RATE};
    const out = [];
    let pos = this._frac;
    while (pos < channel.length) {
      const i = Math.floor(pos);
      const f = pos - i;
      const a = i < channel.length ? channel[i] : this._prev;
      const b = i + 1 < channel.length ? channel[i + 1] : a;
      const sample = Math.max(-1, Math.min(1, a + (b - a) * f));
      out.push(sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767));
      pos += step;
    }
    this._frac = pos - channel.length;
    this._prev = channel[channel.length - 1];
    if (out.length > 0) {
      const pcm = new Int16Array(out);
      this.port.postMessage(pcm, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor(${JSON.stringify(captureWorkletName)}, SpeakFlowCapture);
`;

export type StopCapture = () => void;

export async function startMicCapture(onPcm: (pcm: Int16Array) => void): Promise<StopCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, sampleRate: STT_SAMPLE_RATE },
  });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const sink = context.createGain();
  sink.gain.value = 0;
  sink.connect(context.destination);

  try {
    const moduleUrl = URL.createObjectURL(
      new Blob([captureWorkletCode], { type: "application/javascript" }),
    );
    try {
      await context.audioWorklet.addModule(moduleUrl);
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
    const node = new AudioWorkletNode(context, captureWorkletName);
    node.port.onmessage = (event: MessageEvent<Int16Array>) => onPcm(event.data);
    source.connect(node);
    node.connect(sink);
    return () => {
      node.disconnect();
      void stopAll(stream, context);
    };
  } catch {
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm = floatToPcm16(resampleTo16k(input, context.sampleRate));
      onPcm(pcm);
    };
    source.connect(processor);
    processor.connect(sink);
    return () => {
      processor.disconnect();
      void stopAll(stream, context);
    };
  }
}

async function stopAll(stream: MediaStream, context: AudioContext): Promise<void> {
  for (const track of stream.getTracks()) track.stop();
  await context.close();
}
