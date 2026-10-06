import { useEffect, useState } from "react";
import { dailyTrend, wpmSummary, type TrendDay } from "./trend.ts";
import type { AttemptRow } from "./store.ts";
import "./TrendPanel.css";

// History view (ticket #6): 7-day intelligibility trend = avg(100-WER) per
// day as a simple SVG sparkline, plus stable-WPM summary. Glossary:
// Pronunciation Score (100-WER), Fluency Stats (WPM), Attempt. Semantic
// tokens only; no chart library.
export function TrendPanel() {
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [wpm, setWpm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    window.api
      .listAttempts()
      .then((rows: AttemptRow[]) => {
        const now = new Date().toISOString();
        setTrend(dailyTrend(rows, now, 7));
        const summary = wpmSummary(rows);
        setWpm(rows.length === 0 ? "No Attempts yet." : `${summary.avg} WPM, ${summary.note}`);
      })
      .catch(() => setError("History unreachable."));
  }, []);

  const points = trend.map((day, index) => ({
    x: trend.length === 1 ? 0 : (index / (trend.length - 1)) * 280,
    y: day.intelligibility === null ? 76 : 76 - (day.intelligibility / 100) * 72,
    day,
  }));
  const path = points
    .filter((point) => point.day.intelligibility !== null)
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <section className="trend-panel" aria-label="7-day intelligibility trend">
      <h2>Progress</h2>
      {error !== "" && <p className="trend-error">{error}</p>}
      <svg className="trend-sparkline" viewBox="0 0 280 80" role="img" aria-label="Intelligibility sparkline">
        <path className="trend-line" d={path === "" ? "M0,76 L280,76" : path} fill="none" />
        {points.map(
          (point) =>
            point.day.intelligibility !== null && (
              <circle key={point.day.date} className="trend-dot" cx={point.x} cy={point.y} r="3" />
            ),
        )}
      </svg>
      <ul className="trend-days">
        {trend.map((day) => (
          <li key={day.date}>
            {day.date.slice(5)}: {day.intelligibility === null ? "–" : day.intelligibility}
          </li>
        ))}
      </ul>
      <p className="trend-wpm">WPM: {wpm}</p>
    </section>
  );
}
