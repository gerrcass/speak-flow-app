import { useEffect, useState } from "react";
import type { SrsCard } from "./cards.ts";
import "./DrillPanel.css";

// Tricky-phrases view (ticket #6): SRS cards due for review, soonest
// first. Glossary: Drill (scheduled retry of a failed phrase). Cards enter
// the queue only through promoteToSrs, which demands a DrillQualified proof
// (ADR-0005). Semantic tokens only.
export function DrillPanel() {
  const [cards, setCards] = useState<SrsCard[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    window.api
      .listDueCards(new Date().toISOString())
      .then((due: SrsCard[]) => setCards(due))
      .catch(() => setError("Drill queue unreachable."));
  }, []);

  return (
    <section className="drill-panel" aria-label="Tricky phrases due for review">
      <h2>Tricky phrases</h2>
      {error !== "" && <p className="drill-error">{error}</p>}
      {cards.length === 0 ? (
        <p className="drill-empty">No Drills due. Failed phrases will queue here.</p>
      ) : (
        <ul className="drill-list">
          {cards.map((card) => (
            <li key={card.phraseId} className="drill-item">
              {card.phraseId} — due {card.nextDue.slice(0, 10)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
