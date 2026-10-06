import { useEffect, useState } from "react";
import "./ModelsPanel.css";

// First-run models screen (ticket #6, ADR-0002): the NSIS installer ships
// no model weights, so this panel reuses GET /models/status progress and
// shows where weights live plus whether they are on disk yet. The "Download
// models" button triggers POST /models/download (real load when
// faster-whisper is present, honest stub otherwise); progress keeps arriving
// over the existing status channel, so this screen refreshes that state.
export interface ModelStatus {
  model: string;
  downloaded: boolean;
  path: string;
}

export function ModelsPanel() {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  function refresh(): void {
    window.api
      .modelStatus()
      .then((next: ModelStatus) => {
        setStatus(next);
        setError("");
      })
      .catch(() => setError("Model status unreachable."));
  }

  function download(): void {
    setDownloading(true);
    window.api
      .downloadModels()
      .then(() => {
        setError("");
        refresh();
      })
      .catch(() => setError("Model download unreachable; is the sidecar running?"))
      .finally(() => setDownloading(false));
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
      <button
        type="button"
        className="models-download"
        onClick={download}
        disabled={downloading || status?.downloaded === true}
      >
        {status?.downloaded === true
          ? "Models ready"
          : downloading
            ? "Starting download…"
            : "Download models"}
      </button>
    </section>
  );
}
