// Seam (a)+(b)+(d): Content Pack loader mints ContentPackVerified only on
// valid packs; startSession demands the proof; paste-import roundtrips.
// Glossary: Content Pack, Reference, Prompt, Drill, Attempt.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  importPastedPack,
  withVerifiedPack,
} from "../src/proofs/content-pack-verified.ts";
import { startSession } from "../src/content/session.ts";
import { toPhrasesPack } from "../src/content/pack.ts";
import { resolvePackPath } from "../src/content/pack-files.ts";

function readPack(fileName: string): unknown {
  // Suite runs with apps/desktop as cwd (pnpm -r test); content/ is at the
  // repo root, two levels up.
  return JSON.parse(readFileSync(join(process.cwd(), "..", "..", "content", fileName), "utf8"));
}

function verifies(raw: unknown): boolean {
  return withVerifiedPack(raw, () => true) === true;
}

test("phrases_100.json holds 100 valid References with levels and focus tags", () => {
  const raw = readPack("phrases_100.json") as { items: unknown[] };
  assert.equal(raw.items.length, 100);
  assert.ok(verifies(raw), "bundled phrases pack must verify");
});

test("prompts_30.json holds 30 valid Prompts", () => {
  const raw = readPack("prompts_30.json") as { items: unknown[] };
  assert.equal(raw.items.length, 30);
  assert.ok(verifies(raw), "bundled prompts pack must verify");
});

test("minimal_pairs.json seed verifies", () => {
  assert.ok(verifies(readPack("minimal_pairs.json")), "minimal-pairs seed must verify");
});

test("loader rejects a bad level tag", () => {
  const raw = readPack("phrases_100.json") as { items: Record<string, unknown>[] };
  const tampered = {
    ...(raw as object),
    items: [{ ...raw.items[0], level: "C9" }],
  };
  assert.equal(verifies(tampered), false);
});

test("loader rejects a Reference without a focus tag", () => {
  const raw = readPack("phrases_100.json") as { items: Record<string, unknown>[] };
  const tampered = {
    ...(raw as object),
    items: [{ ...raw.items[0], tags: [] }],
  };
  assert.equal(verifies(tampered), false);
});

test("loader rejects non-JSON-shaped packs", () => {
  assert.equal(verifies(null), false);
  assert.equal(verifies({ kind: "phrases" }), false);
});

test("startSession runs with a minted proof and rejects a forged one", () => {
  const raw = readPack("prompts_30.json");
  const session = withVerifiedPack(raw, (pack, proof) => startSession(pack, proof));
  assert.ok(session !== null);
  assert.ok(session.id.length > 0);
  // Forging a proof needs an `as` cast, which the gdp-ts lint preset bans;
  // the runtime kind check still rejects it. See docs/gdp-ts/README.md.
  assert.throws(
    () => withVerifiedPack(raw, (pack) => startSession(pack, { kind: "Forged" } as never)),
    /ContentPackVerified/,
  );
  assert.throws(
    () =>
      withVerifiedPack(raw, (pack) => {
        // @ts-expect-error startSession demands a ContentPackVerified proof
        return startSession(pack);
      }),
    /ContentPackVerified/,
  );
});

test("paste-import roundtrip: textarea text verifies and starts a session", () => {
  const pasted = JSON.stringify(readPack("phrases_100.json"));
  const pack = importPastedPack(pasted);
  assert.ok(pack !== null, "pasted pack must verify");
  const session = withVerifiedPack(pack, (named, proof) => startSession(named, proof));
  assert.ok(session !== null && session.items > 0);
});

test("paste-import rejects malformed JSON text", () => {
  assert.equal(importPastedPack("not json{"), null);
  assert.equal(importPastedPack(JSON.stringify({ items: [] })), null);
});

test("generated items wrap into a verifiable phrases pack", () => {
  const pack = toPhrasesPack("generated-1", [
    { text: "Say it slowly: think.", level: "A1", tags: ["th"] },
  ]);
  assert.ok(pack !== null && pack.kind === "phrases");
  assert.ok(verifies(pack));
  assert.equal(toPhrasesPack("generated-2", [{ text: "", level: "A1", tags: ["th"] }]), null);
  assert.equal(toPhrasesPack("generated-3", "nope"), null);
});

test("bundled pack paths resolve inside the content dir only", () => {
  assert.ok(resolvePackPath("/base", "phrases_100.json").endsWith("phrases_100.json"));
  assert.throws(() => resolvePackPath("/base", "../sidecar/main.py"), /unknown Content Pack/);
  assert.throws(() => resolvePackPath("/base", "evil.json"), /unknown Content Pack/);
});
