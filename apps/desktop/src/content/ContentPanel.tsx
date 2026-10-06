import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { importPastedPack, withVerifiedPack } from "../proofs/content-pack-verified.ts";
import { toPhrasesPack, type ContentPack } from "./pack.ts";
import { BUNDLED_PACK_FILES } from "./pack-files.ts";
import { startSession, type PracticeSession } from "./session.ts";
import { getByokKey, setByokKey } from "./byok-key.ts";
import type { BundledPackName, GenerateProvider } from "../renderer/api";
import "./ContentPanel.css";

type Level = "A1" | "A2" | "B1";
type Focus = "th" | "ed" | "stress";

interface ListedPack {
  source: string;
  pack: ContentPack;
}

const PROVIDER_BADGE: Record<GenerateProvider, string> = {
  local: "Local (offline)",
  byok: "BYOK (cloud, billed to your key)",
};

// Content Packs panel (ticket #3): bundled packs load verified, manual
// paste-import works day one, and POST /content/generate offers local vs
// BYOK generation. Every listed pack carries a ContentPackVerified proof at
// session start. Glossary: Content Pack, Reference, Prompt, Drill.
export function ContentPanel() {
  const [packs, setPacks] = useState<ListedPack[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<GenerateProvider>("local");
  const [level, setLevel] = useState<Level>("A1");
  const [focus, setFocus] = useState<Focus>("th");
  const [keyInput, setKeyInput] = useState(getByokKey() ?? "");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded: ListedPack[] = [];
      for (const file of BUNDLED_PACK_FILES) {
        try {
          const text = await window.api.readContentPack(file as BundledPackName);
          const pack = importPastedPack(text);
          if (pack !== null && !cancelled) loaded.push({ source: file, pack });
        } catch {
          if (!cancelled) setError(`Could not load bundled pack ${file}.`);
        }
      }
      if (!cancelled) setPacks(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function beginSession(source: string, pack: ContentPack) {
    setError("");
    try {
      const session = withVerifiedPack(pack, (named, proof) => startSession(named, proof));
      if (session === null) throw new Error("pack failed verification");
      setSessions((previous) => [...previous, { ...session, id: `${session.id}-${source}` }]);
    } catch {
      setError(`Pack ${source} failed verification and cannot start a session.`);
    }
  }

  function importFromTextarea() {
    const pack = importPastedPack(pasted);
    if (pack === null) {
      setError("Pasted text is not a valid Content Pack (check JSON, kind, levels, tags).");
      return;
    }
    setPasted("");
    setPacks((previous) => [...previous, { source: "pasted", pack }]);
    beginSession("pasted", pack);
  }

  async function generate() {
    setError("");
    try {
      const generated = await window.api.generateContent({
        provider,
        level,
        focus,
        count: 5,
        key: provider === "byok" ? (getByokKey() ?? undefined) : undefined,
      });
      const pack = toPhrasesPack(`generated-${Date.now()}`, generated.items);
      if (pack === null) throw new Error("generated items failed validation");
      setPacks((previous) => [...previous, { source: `generated-${provider}`, pack }]);
      beginSession(`generated-${provider}`, pack);
    } catch {
      setError(
        provider === "byok" && getByokKey() === null
          ? "BYOK needs your provider key first (kept in session memory only)."
          : "Content generation failed; is the sidecar running?",
      );
    }
  }

  return (
    <section className="content-panel" aria-label="Content Packs">
      <h2>Content Packs</h2>
      <ul className="pack-list">
        {packs.map((entry, index) => (
          <li key={`${entry.source}-${index}`} className="pack-row">
            <span className="pack-name">{entry.pack.id}</span>
            <span className="pack-kind">{entry.pack.kind}</span>
            <span className="badge-verified">Verified</span>
            <span className="pack-count">{entry.pack.items.length} items</span>
            <Button variant="secondary" size="sm" onClick={() => beginSession(entry.source, entry.pack)}>
              Start session
            </Button>
          </li>
        ))}
      </ul>
      {packs.length === 0 && <p className="pack-empty">No verified packs yet; paste one below.</p>}

      <h3>Manual import</h3>
      <textarea
        className="pack-paste"
        aria-label="Paste a Content Pack as JSON"
        value={pasted}
        onChange={(event) => setPasted(event.target.value)}
        placeholder='Paste {"id": ..., "kind": "phrases"|"prompts"|"minimal-pairs", "items": [...]}'
        rows={4}
      />
      <Button variant="primary" size="md" onClick={importFromTextarea}>
        Import pasted pack
      </Button>

      <h3>Generate</h3>
      <p className="provider-row">
        <span className={provider === "local" ? "badge-provider-local" : "badge-provider-byok"}>
          {PROVIDER_BADGE[provider]}
        </span>
      </p>
      <div className="generate-row">
        <label>
          Provider
          <select value={provider} onChange={(event) => setProvider(event.target.value as GenerateProvider)}>
            <option value="local">local</option>
            <option value="byok">byok</option>
          </select>
        </label>
        <label>
          Level
          <select value={level} onChange={(event) => setLevel(event.target.value as Level)}>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
          </select>
        </label>
        <label>
          Focus
          <select value={focus} onChange={(event) => setFocus(event.target.value as Focus)}>
            <option value="th">th</option>
            <option value="ed">ed</option>
            <option value="stress">stress</option>
          </select>
        </label>
      </div>
      {provider === "byok" && (
        <label className="byok-key">
          Your provider key
          <input
            type="password"
            value={keyInput}
            onChange={(event) => {
              setKeyInput(event.target.value);
              setByokKey(event.target.value);
            }}
            placeholder="Pasted key, session memory only"
            autoComplete="off"
          />
        </label>
      )}
      <p className="key-note">
        Your key is kept in the OS keychain via Electron safeStorage when available, otherwise only in
        session memory. It is never bundled with the app, never stored server-side, and never committed.
      </p>
      <Button variant="primary" size="md" onClick={() => void generate()}>
        Generate 5 References
      </Button>

      {error !== "" && (
        <p className="content-error" role="alert">
          {error}
        </p>
      )}

      {sessions.length > 0 && (
        <>
          <h3>Sessions</h3>
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id} className="session-row">
                {session.packId} · {session.kind} · {session.items} items · {session.startedAt}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
