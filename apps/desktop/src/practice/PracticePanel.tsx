import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { withTranscribedAttempt } from "../proofs/attempt-transcribed.ts";
import { scoreAttempt, type AttemptResult } from "../scoring/attempt.ts";
import { parseSttMessage, sttStreamUrl, STT_SAMPLE_RATE } from "../stt/audio.ts";
import { startMicCapture, type StopCapture } from "../stt/capture.ts";
import "./PracticePanel.css";

type Phase = "idle" | "recording" | "scoring" | "scored" | "error";

const BAND_TOKEN: Record<AttemptResult["band"], string> = {
  pass: "var(--color-feedback-pass)",
  warn: "var(--color-feedback-warn)",
  fail: "var(--color-feedback-fail)",
};

function pcmChunksToWavUrl(chunks: Int16Array[]): string {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const pcm = new Int16Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    pcm.set(chunk, offset);
    offset += chunk.length;
  }
  const buffer = new ArrayBuffer(44 + total * 2);
  const view = new DataView(buffer);
  const writeAscii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(at + i, text.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + total * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, STT_SAMPLE_RATE, true);
  view.setUint32(28, STT_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, total * 2, true);
  for (let i = 0; i < total; i += 1) view.setInt16(44 + i * 2, pcm[i], true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

// Repeat-after-me + Read-Aloud scored loop (ticket #4): show a Reference,
// play a Piper TTS example, record an Attempt, then score it. Scoring runs
// only through withTranscribedAttempt → scoreAttempt, so an Attempt without
// a Transcript (silence, error) can never produce a Pronunciation Score.
// Glossary: Reference, Transcript, Attempt, Pronunciation Score, Fluency Stats.
export function PracticePanel({ initialReference = "The cat sat on the mat." }: { initialReference?: string }) {
  const [reference, setReference] = useState(initialReference);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const [ttsEngine, setTtsEngine] = useState<string | null>(null);
  const [attemptUrl, setAttemptUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const stopCapture = useRef<StopCapture | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const chunks = useRef<Int16Array[]>([]);
  const startedAt = useRef(0);
  const attemptSeq = useRef(0);

  useEffect(
    () => () => {
      stopCapture.current?.();
      socket.current?.close();
      if (ttsUrl !== null) URL.revokeObjectURL(ttsUrl);
      if (attemptUrl !== null) URL.revokeObjectURL(attemptUrl);
    },
    // URLs are session-scoped; revoked only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function playExample() {
    setError("");
    try {
      const { audio, engine } = await window.api.ttsExample(reference);
      if (ttsUrl !== null) URL.revokeObjectURL(ttsUrl);
      const url = `data:audio/wav;base64,${audio}`;
      setTtsUrl(url);
      setTtsEngine(engine);
      await new Audio(url).play();
    } catch {
      setError("TTS example unreachable; is the sidecar running?");
    }
  }

  async function record() {
    setError("");
    setTranscript("");
    setResult(null);
    if (attemptUrl !== null) {
      URL.revokeObjectURL(attemptUrl);
      setAttemptUrl(null);
    }
    setPhase("recording");
    chunks.current = [];
    startedAt.current = Date.now();
    try {
      const config = await window.api.sttConfig();
      const ws = new WebSocket(sttStreamUrl(config.port, config.token));
      socket.current = ws;
      ws.onmessage = (event: MessageEvent<string>) => {
        const message = parseSttMessage(event.data);
        if (message.type === "final") {
          setTranscript(message.text);
          finishAttempt(message.text);
        } else if (message.type === "partial") {
          setTranscript(message.text);
        }
      };
      ws.onerror = () => {
        setError("STT stream unreachable; is the sidecar running?");
        setPhase("error");
      };
      ws.onopen = () => {
        startMicCapture((pcm) => {
          chunks.current.push(Int16Array.from(pcm));
          if (ws.readyState === WebSocket.OPEN) ws.send(pcm.buffer as ArrayBuffer);
        }).then(
          (stop) => {
            stopCapture.current = stop;
          },
          () => {
            setError("Microphone unavailable.");
            setPhase("error");
            ws.close();
          },
        );
      };
    } catch {
      setError("STT stream unreachable; is the sidecar running?");
      setPhase("error");
    }
  }

  function finishAttempt(finalTranscript: string) {
    const audioMs = Math.max(1, Date.now() - startedAt.current);
    stopCapture.current?.();
    stopCapture.current = null;
    socket.current?.close();
    socket.current = null;
    setAttemptUrl(pcmChunksToWavUrl(chunks.current));
    setPhase("scoring");
    attemptSeq.current += 1;
    const scored = withTranscribedAttempt(
      { id: `attempt-${attemptSeq.current}`, reference, audioMs },
      finalTranscript,
      (attempt, proof) => scoreAttempt(attempt, proof),
    );
    if (scored === null) {
      setError("No speech transcribed; try again.");
      setPhase("error");
      return;
    }
    setResult(scored);
    setPhase("scored");
  }

  function stop() {
    socket.current?.send(JSON.stringify({ type: "end" }));
  }

  async function replayBoth() {
    if (ttsUrl !== null) await new Audio(ttsUrl).play().catch(() => undefined);
    if (attemptUrl !== null) await new Audio(attemptUrl).play().catch(() => undefined);
  }

  return (
    <section className="practice-panel" aria-label="Repeat after me practice">
      <h2>Repeat after me</h2>
      <label className="practice-reference-label" htmlFor="practice-reference">
        Reference
      </label>
      <input
        id="practice-reference"
        className="practice-reference"
        value={reference}
        onChange={(event) => setReference(event.target.value)}
      />
      <div className="practice-actions">
        <Button variant="secondary" size="md" onClick={playExample}>
          Play example
        </Button>
        {phase === "recording" ? (
          <Button variant="danger" size="md" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={record}>
            {phase === "scored" ? "Retry" : "Record Attempt"}
          </Button>
        )}
        {phase === "scored" && attemptUrl !== null && ttsUrl !== null && (
          <Button variant="secondary" size="md" onClick={replayBoth}>
            You vs TTS
          </Button>
        )}
      </div>
      {/* X-TTS-Engine stays truthful: "stub (offline)" labels synthetic audio. */}
      {ttsEngine !== null && (
        <p className="practice-tts-engine">
          Example voice: {ttsEngine === "stub" ? "stub (offline)" : ttsEngine}
        </p>
      )}
      {error !== "" && (
        <p className="practice-error" role="alert">
          {error}
        </p>
      )}
      {transcript !== "" && <p className="practice-transcript">Transcript: {transcript}</p>}
      {result !== null && (
        <div className="practice-result">
          <p className="practice-score" style={{ color: BAND_TOKEN[result.band] }}>
            Pronunciation Score: {result.score} ({result.band})
          </p>
          {result.failed.length > 0 && (
            <ul className="practice-failed" aria-label="Failed words">
              {result.failed.map((word) => (
                <li key={word} style={{ color: BAND_TOKEN.fail }}>
                  {word}
                </li>
              ))}
            </ul>
          )}
          <p className="practice-fluency">
            Fluency Stats: {result.fluency.wpm} WPM, pause{" "}
            {Math.round(result.fluency.pauseRatio * 100)}%, fillers{" "}
            {result.fluency.fillerRate.toFixed(1)}/min
          </p>
        </div>
      )}
      {/* spec-mandated Spanish disclaimer (#4), exempt from English-everywhere */}
      <p className="practice-disclaimer">emulación calibrada, no certificador</p>
    </section>
  );
}
