import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { parseSttMessage, sttStreamUrl } from "./audio.ts";
import { startMicCapture, type StopCapture } from "./capture.ts";
import "./SttPanel.css";

type Phase = "idle" | "connecting" | "recording" | "error";

// Live Transcript panel (ticket #2): streams 16kHz mic PCM to the local
// sidecar WS and shows partial + final Transcript. Scoring is out of scope.
export function SttPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [partial, setPartial] = useState("");
  const [transcript, setTranscript] = useState("");
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [error, setError] = useState("");
  const stopCapture = useRef<StopCapture | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const endRequested = useRef(false);

  useEffect(
    () => () => {
      stopCapture.current?.();
      socket.current?.close();
    },
    [],
  );

  async function start() {
    setError("");
    setPartial("");
    setTranscript("");
    setDownloadPct(null);
    endRequested.current = false;
    setPhase("connecting");
    try {
      const config = await window.api.sttConfig();
      const ws = new WebSocket(sttStreamUrl(config.port, config.token));
      socket.current = ws;
      ws.onmessage = (event: MessageEvent<string>) => {
        const message = parseSttMessage(event.data);
        if (message.type === "partial") setPartial(message.text);
        else if (message.type === "final") {
          setTranscript(message.text);
          setPartial("");
          if (endRequested.current) stopAll();
        } else setDownloadPct(message.pct);
      };
      ws.onerror = () => {
        setError("STT stream unreachable; is the sidecar running?");
        setPhase("error");
      };
      ws.onopen = () => {
        setPhase("recording");
        startMicCapture((pcm) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(pcm.buffer as ArrayBuffer);
        })
          .then((stop) => {
            stopCapture.current = stop;
          })
          .catch((cause: unknown) => {
            setError(
              cause instanceof DOMException && cause.name === "NotAllowedError"
                ? "Microphone blocked; allow mic access and retry."
                : "Microphone unavailable.",
            );
            setPhase("error");
            ws.close();
          });
      };
    } catch {
      setError("STT stream unreachable; is the sidecar running?");
      setPhase("error");
    }
  }

  function stopAll() {
    stopCapture.current?.();
    stopCapture.current = null;
    socket.current?.close();
    socket.current = null;
    setPhase("idle");
  }

  function stop() {
    endRequested.current = true;
    socket.current?.send(JSON.stringify({ type: "end" }));
  }

  const recording = phase === "recording" || phase === "connecting";

  return (
    <section className="stt-panel" aria-label="Live Transcript">
      <h2>Live Transcript</h2>
      <Button variant={recording ? "danger" : "primary"} size="md" onClick={recording ? stop : start}>
        {recording ? "Stop" : "Record"}
      </Button>
      {downloadPct !== null && phase !== "idle" && (
        <p className="stt-progress" role="status">
          Downloading speech model… {downloadPct}%
        </p>
      )}
      {error !== "" && (
        <p className="stt-error" role="alert">
          {error}
        </p>
      )}
      <p className="stt-partial" aria-live="polite">
        {partial}
      </p>
      {transcript !== "" && <p className="stt-final">Transcript: {transcript}</p>}
    </section>
  );
}
