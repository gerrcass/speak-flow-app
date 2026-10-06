import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import type { Prompt } from "../content/pack.ts";
import { ContentPackSchema } from "../content/pack.ts";
import { parseSttMessage, sttStreamUrl } from "../stt/audio.ts";
import { startMicCapture, type StopCapture } from "../stt/capture.ts";
import { snippet } from "./history.ts";
import type { AttemptRow } from "./store.ts";
import { cefrHints, keywordRecall, typeTokenRatio, type CefrHintResult } from "./rubric.ts";
import { computeFluency, type FluencyStats } from "../scoring/scoring.ts";
import { durationMs, FREE_TALK_DURATIONS, isTimeUp, remainingMs, type FreeTalkDuration } from "./timer.ts";
import "./FreetalkPanel.css";

type Phase = "idle" | "recording" | "scored" | "error";

interface SoftRubric {
  recall: number;
  hits: string[];
  keywords: string[];
  ttr: number;
  cefr: CefrHintResult;
  fluency: FluencyStats;
}

function promptText(prompts: Prompt[], promptId: string): string {
  return prompts.find((prompt) => prompt.id === promptId)?.text ?? promptId;
}

// Free-talk loop (ticket #5): speak from a cue-card Prompt against a
// 45/60/90s timer, then keep the Attempt. Soft rubric only — keyword recall
// + TTR + CEFR hints + Fluency Stats, never a hard grade. Persists to the
// local SQLite attempts table (format 'free-talk', wer null: no Reference
// exists to compare against). Glossary: Free-talk, Prompt, Attempt,
// Transcript, Fluency Stats.
export function FreetalkPanel() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [duration, setDuration] = useState<FreeTalkDuration>("60");
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(durationMs("60"));
  const [transcript, setTranscript] = useState("");
  const [rubric, setRubric] = useState<SoftRubric | null>(null);
  const [history, setHistory] = useState<AttemptRow[]>([]);
  const [error, setError] = useState("");
  const stopCapture = useRef<StopCapture | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const startedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptSeq = useRef(0);

  useEffect(() => {
    window.api
      .readContentPack("prompts_30.json")
      .then((raw) => {
        const pack = ContentPackSchema.parse(JSON.parse(raw));
        if (pack.kind === "prompts") setPrompts(pack.items);
      })
      .catch(() => setError("Prompt pack unreachable."));
    window.api
      .listAttempts()
      .then((rows) => setHistory(rows.filter((row) => row.format === "free-talk")))
      .catch(() => undefined);
    return () => {
      stopCapture.current?.();
      socket.current?.close();
      if (ticker.current !== null) clearInterval(ticker.current);
      if (autoStop.current !== null) clearTimeout(autoStop.current);
    };
  }, []);

  const prompt = prompts[promptIndex] ?? null;

  function clearTimers() {
    if (ticker.current !== null) clearInterval(ticker.current);
    if (autoStop.current !== null) clearTimeout(autoStop.current);
    ticker.current = null;
    autoStop.current = null;
  }

  async function record() {
    if (prompt === null) return;
    setError("");
    setTranscript("");
    setRubric(null);
    setPhase("recording");
    setRemaining(durationMs(duration));
    startedAt.current = Date.now();
    const chosen = duration;
    const activePrompt = prompt;
    try {
      const config = await window.api.sttConfig();
      const ws = new WebSocket(sttStreamUrl(config.port, config.token));
      socket.current = ws;
      ws.onmessage = (event: MessageEvent<string>) => {
        const message = parseSttMessage(event.data);
        if (message.type === "final") {
          setTranscript(message.text);
          void finishAttempt(message.text, activePrompt, chosen);
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
      ticker.current = setInterval(() => {
        const elapsed = Date.now() - startedAt.current;
        setRemaining(remainingMs(chosen, elapsed));
      }, 250);
      autoStop.current = setTimeout(() => {
        socket.current?.send(JSON.stringify({ type: "end" }));
      }, durationMs(chosen));
    } catch {
      setError("STT stream unreachable; is the sidecar running?");
      setPhase("error");
    }
  }

  async function finishAttempt(finalTranscript: string, activePrompt: Prompt, chosen: FreeTalkDuration) {
    const audioMs = Math.max(1, Date.now() - startedAt.current);
    clearTimers();
    stopCapture.current?.();
    stopCapture.current = null;
    socket.current?.close();
    socket.current = null;
    if (!isTimeUp(chosen, audioMs) && finalTranscript.trim() === "") {
      setError("No speech transcribed; try again.");
      setPhase("error");
      return;
    }
    const fluency = computeFluency({ transcript: finalTranscript, speechMs: audioMs, totalMs: audioMs });
    const recall = keywordRecall(activePrompt.text, finalTranscript);
    attemptSeq.current += 1;
    const row: AttemptRow = {
      id: `freetalk-${Date.now()}-${attemptSeq.current}`,
      format: "free-talk",
      promptId: activePrompt.id,
      transcript: finalTranscript,
      wpm: fluency.wpm,
      pauseRatio: fluency.pauseRatio,
      wer: null,
      date: new Date().toISOString(),
    };
    setRubric({
      recall: recall.recall,
      hits: recall.hits,
      keywords: recall.keywords,
      ttr: typeTokenRatio(finalTranscript),
      cefr: cefrHints(finalTranscript),
      fluency,
    });
    setPhase("scored");
    try {
      await window.api.saveAttempt(row);
      const rows = await window.api.listAttempts();
      setHistory(rows.filter((item) => item.format === "free-talk"));
    } catch {
      setError("Attempt kept on screen but not saved; storage unreachable.");
    }
  }

  function stop() {
    socket.current?.send(JSON.stringify({ type: "end" }));
  }

  return (
    <section className="freetalk-panel" aria-label="Free-talk practice">
      <h2>Free-talk</h2>
      {prompt !== null && (
        <blockquote className="freetalk-cue-card">
          <p className="freetalk-cue-text">{prompt.text}</p>
          <cite className="freetalk-cue-level">{prompt.level}</cite>
        </blockquote>
      )}
      <div className="freetalk-controls">
        <label className="freetalk-duration-label" htmlFor="freetalk-duration">
          Timer
        </label>
        <select
          id="freetalk-duration"
          className="freetalk-duration"
          value={duration}
          onChange={(event) => {
            setDuration(event.target.value as FreeTalkDuration);
            setRemaining(durationMs(event.target.value as FreeTalkDuration));
          }}
          disabled={phase === "recording"}
        >
          {FREE_TALK_DURATIONS.map((option) => (
            <option key={option} value={option}>
              {option}s
            </option>
          ))}
        </select>
        {prompts.length > 1 && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => setPromptIndex((index) => (index + 1) % prompts.length)}
          >
            Next Prompt
          </Button>
        )}
        {phase === "recording" ? (
          <Button variant="danger" size="md" onClick={stop}>
            Stop ({Math.ceil(remaining / 1000)}s left)
          </Button>
        ) : (
          prompt !== null && (
            <Button variant="primary" size="md" onClick={() => void record()}>
              {rubric !== null ? "Talk again" : "Record Attempt"}
            </Button>
          )
        )}
      </div>
      {error !== "" && (
        <p className="freetalk-error" role="alert">
          {error}
        </p>
      )}
      {transcript !== "" && <p className="freetalk-transcript">Transcript: {transcript}</p>}
      {rubric !== null && (
        <div className="freetalk-rubric">
          <p className="freetalk-recall">
            Keyword recall: {rubric.hits.length}/{rubric.keywords.length} ({Math.round(rubric.recall)}%)
          </p>
          <p className="freetalk-ttr">Vocabulary variety (TTR): {rubric.ttr.toFixed(2)}</p>
          <p className="freetalk-cefr">
            CEFR hint: {rubric.cefr.bandHint} — {rubric.cefr.hints.join(" ")}
          </p>
          <p className="freetalk-fluency">
            Fluency Stats: {rubric.fluency.wpm} WPM, pause {Math.round(rubric.fluency.pauseRatio * 100)}%,
            fillers {rubric.fluency.fillerRate.toFixed(1)}/min
          </p>
        </div>
      )}
      <p className="freetalk-disclaimer">emulacion calibrada, no certificador</p>
      {history.length > 0 && (
        <div className="freetalk-history">
          <h3>History</h3>
          <ul className="freetalk-history-list">
            {history.map((item) => (
              <li key={item.id} className="freetalk-history-item">
                <span className="freetalk-history-date">{new Date(item.date).toLocaleString()}</span>
                <span className="freetalk-history-prompt">{promptText(prompts, item.promptId)}</span>
                <span className="freetalk-history-wpm">{item.wpm} WPM</span>
                <span className="freetalk-history-snippet">{snippet(item.transcript)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
