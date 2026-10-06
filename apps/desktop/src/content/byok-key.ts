// Session-memory holder for the user's BYOK provider key (ADR-0004).
// The key lives only in renderer memory for this session: it is sent
// per-request in the X-Provider-Key header, never written to disk, never
// bundled, never committed. When Electron safeStorage is available the main
// process persists it in the OS keychain instead; this module is the
// fallback that guarantees nothing leaks to storage.
let key: string | null = null;

export function setByokKey(value: string | null): void {
  key = value !== null && value.length > 0 ? value : null;
}

export function getByokKey(): string | null {
  return key;
}

export function clearByokKey(): void {
  key = null;
}
