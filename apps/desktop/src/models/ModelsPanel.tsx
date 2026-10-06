import { useEffect, useState } from "react";
import "./ModelsPanel.css";

// First-run models screen (ticket #6, ADR-0002): the NSIS installer ships
// no model weights, so this panel reuses GET /models/status progress and
// shows where weights live plus whether they are on disk yet. The sidecar
// fetches weights on first transcription; this screen refreshes that state.
export interface ModelStatus {
  model: string;
  downloaded: boolean;
  path: string;
}

export function ModelsPanel() {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [error, setError] = useState("");

  function refresh(): void {
    window.api
      .modelStatus()
      .then((next: ModelStatus) => {
        setStatus(next);
        setError("");
      })
      .catch(() => setError("Model status unreachable."));
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="models-panel" aria-label="Speech model status">
      <h2>Speech models</h2>
      {error !== "" && <p className="models-error">{error}</p>}
      {status === null ? (
        <p className="models-empty">Checking model status…</p>
      ) : (
        <p className="models-status">
          {status.model}: {status.downloaded ? "ready" : "downloads on first run"} ({status.path})
        </p>
      )}
      <button type="button" className="models-refresh" onClick={refresh}>
        Check again
      </button>
    </section>
  );
}
