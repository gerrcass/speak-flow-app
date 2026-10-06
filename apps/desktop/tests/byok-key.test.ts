// Seam: BYOK key holder — session memory plus the preload bridge to the OS
// keychain (Electron safeStorage). Glossary: none (infrastructure for BYOK).
// RED: fails until apps/desktop/src/content/byok-key.ts uses the bridge.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  clearByokKey,
  getByokKey,
  hasStoredByokKey,
  loadByokKeyFromStore,
  setByokKey,
} from "../src/content/byok-key.ts";

type Globals = Record<string, unknown>;

function clearWindow(): void {
  delete (globalThis as Globals).window;
}

function installMockBridge(stored: { key: string | null }, calls: string[]): void {
  (globalThis as Globals).window = {
    api: {
      setByokKey: async (value: string | null) => {
        calls.push(`set:${value ?? "null"}`);
        stored.key = value;
        return true;
      },
      getByokKey: async () => stored.key,
      hasByokKey: async () => stored.key !== null,
    },
  };
}

test("without a bridge the key lives in session memory only", () => {
  clearWindow();
  clearByokKey();
  assert.equal(getByokKey(), null);
  setByokKey("secret-1");
  assert.equal(getByokKey(), "secret-1");
  setByokKey("");
  assert.equal(getByokKey(), null);
  clearWindow();
});

test("with a bridge setByokKey forwards to the OS keychain store", async () => {
  const stored = { key: null as string | null };
  const calls: string[] = [];
  installMockBridge(stored, calls);
  clearByokKey();
  calls.length = 0;
  setByokKey("secret-2");
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(calls.includes("set:secret-2"));
  assert.equal(stored.key, "secret-2");
  assert.equal(getByokKey(), "secret-2");
  clearWindow();
});

test("with a bridge load hydrates memory and has reports the stored key", async () => {
  clearWindow();
  clearByokKey();
  const stored = { key: "stored-secret" as string | null };
  const calls: string[] = [];
  installMockBridge(stored, calls);
  assert.equal(getByokKey(), null);
  await loadByokKeyFromStore();
  assert.equal(getByokKey(), "stored-secret");
  assert.equal(await hasStoredByokKey(), true);
  clearWindow();
  clearByokKey();
  clearWindow();
});
