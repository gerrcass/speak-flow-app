import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { ContentPanel } from "../content/ContentPanel";
import { SttPanel } from "../stt/SttPanel";

// Placeholder window for ticket #1. Practice formats (Repeat-after-me,
// Read-Aloud, Free-talk) and their Attempt loop arrive in later tickets.
export function App() {
  const [health, setHealth] = useState("checking sidecar…");

  useEffect(() => {
    window.api
      .sidecarHealth()
      .then((status) => setHealth(`sidecar /health: ${status}`))
      .catch(() => setHealth("sidecar /health: unreachable"));
  }, []);

  return (
    <main>
      <h1>Speak Flow</h1>
      <p>Local English speaking practice. Formats: Repeat-after-me, Read-Aloud, Free-talk.</p>
      <p>{health}</p>
      <Button
        variant="primary"
        size="md"
        onClick={() => setHealth("Attempt recording arrives in ticket #4")}
      >
        Record Attempt
      </Button>
      <SttPanel />
      <ContentPanel />
    </main>
  );
}
