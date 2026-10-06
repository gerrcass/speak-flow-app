// BYOK provider key holder (ADR-0004).
// The key lives in renderer session memory for this run and is sent
// per-request in the X-Provider-Key header, never bundled, never committed,
// never logged. When the Electron preload bridge offers it, the key is also
// persisted in the OS keychain via main-process safeStorage (byok:set/get/has
// IPC); without the bridge this module is the memory-only fallback that
// guarantees nothing leaks to storage.
let key: string | null = null;

interface ByokBridge {
  setByokKey: (value: string | null) => Promise<boolean>;
  getByokKey: () => Promise<string | null>;
  hasByokKey: () => Promise<boolean>;
}

function bridge(): ByokBridge | null {
  const api = (globalThis as { window?: { api?: Partial<ByokBridge> } }).window?.api;
  if (
    !api ||
    typeof api.setByokKey !== "function" ||
    typeof api.getByokKey !== "function" ||
    typeof api.hasByokKey !== "function"
  ) {
    return null;
  }
  return api as ByokBridge;
}

export function setByokKey(value: string | null): void {
  key = value !== null && value.length > 0 ? value : null;
  // Persist to the OS keychain when the bridge offers it; a rejected store
  // leaves the session-memory copy serving this run.
  try {
    void bridge()
      ?.setByokKey(key)
      .catch(() => undefined);
  } catch {
    // No bridge (tests, non-Electron hosts): memory only.
  }
}

export function getByokKey(): string | null {
  return key;
}

export function clearByokKey(): void {
  setByokKey(null);
}

/** Hydrate session memory from the OS keychain store when the bridge offers it. */
export async function loadByokKeyFromStore(): Promise<void> {
  const via = bridge();
  if (!via) return;
  try {
    key = await via.getByokKey();
  } catch {
    // Keychain unreachable: keep whatever session memory holds.
  }
}

/** True when a key exists in memory or in the OS keychain store. */
export async function hasStoredByokKey(): Promise<boolean> {
  if (key !== null) return true;
  try {
    return (await bridge()?.hasByokKey()) ?? false;
  } catch {
    return false;
  }
}
