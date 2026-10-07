// Preload bridge: sandboxed (no Node.js here: no process.env, fs, or path).
// File reads and env-dependent config live in main and are reached via ipc.
// fetch is a Chromium API, so sidecar HTTP calls stay in the preload.
import { contextBridge, ipcRenderer } from "electron";
import type { AttemptRow } from "./freetalk/store";

async function sidecarHealth(): Promise<string> {
  const { port, token } = await sttConfig();
  const response = await fetch(`http://127.0.0.1:${port}/health`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`sidecar unhealthy: ${response.status}`);
  const body = (await response.json()) as { status?: string };
  return body.status ?? "unknown";
}

contextBridge.exposeInMainWorld("api", {
  sidecarHealth,
  sttConfig,
  readContentPack,
  generateContent,
  ttsExample,
  saveAttempt,
  listAttempts,
  listDueCards,
  modelStatus,
  downloadModels,
  setByokKey,
  getByokKey,
  hasByokKey,
});

export interface SttConfig {
  port: number;
  token: string;
}

async function sttConfig(): Promise<SttConfig> {
  return ipcRenderer.invoke("sidecar:config") as Promise<SttConfig>;
}

async function readContentPack(name: string): Promise<string> {
  return ipcRenderer.invoke("content:read", name) as Promise<string>;
}

export type GenerateProvider = "local" | "byok";

export interface GenerateContentRequest {
  provider: GenerateProvider;
  level: string;
  focus: string;
  count: number;
  key?: string;
}

async function generateContent(request: GenerateContentRequest): Promise<unknown> {
  const { port, token } = await sttConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  // The user key travels per-request in memory only: never persisted here.
  if (request.key) headers["X-Provider-Key"] = request.key;
  const response = await fetch(`http://127.0.0.1:${port}/content/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider: request.provider,
      level: request.level,
      focus: request.focus,
      count: request.count,
    }),
  });
  if (!response.ok) throw new Error(`content generate failed: ${response.status}`);
  return response.json();
}

export interface TtsExample {
  audio: string;
  engine: "piper" | "stub";
}

async function ttsExample(text: string): Promise<TtsExample> {
  const { port, token } = await sttConfig();
  const response = await fetch(
    `http://127.0.0.1:${port}/tts/example?text=${encodeURIComponent(text)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(`tts example failed: ${response.status}`);
  const engine = response.headers.get("x-tts-engine") === "piper" ? "piper" : "stub";
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { audio: btoa(binary), engine };
}

async function saveAttempt(row: AttemptRow): Promise<boolean> {
  return ipcRenderer.invoke("attempts:save", row) as Promise<boolean>;
}

async function listAttempts(): Promise<AttemptRow[]> {
  return ipcRenderer.invoke("attempts:list") as Promise<AttemptRow[]>;
}

async function listDueCards(now: string): Promise<unknown> {
  return ipcRenderer.invoke("srs:list-due", now) as Promise<unknown>;
}

export interface ModelStatus {
  model: string;
  downloaded: boolean;
  path: string;
}

async function modelStatus(): Promise<ModelStatus> {
  const { port, token } = await sttConfig();
  const response = await fetch(`http://127.0.0.1:${port}/models/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`models status failed: ${response.status}`);
  return response.json() as Promise<ModelStatus>;
}

export interface ModelDownload {
  started: boolean;
  downloaded: boolean;
}

async function downloadModels(): Promise<ModelDownload> {
  const { port, token } = await sttConfig();
  const response = await fetch(`http://127.0.0.1:${port}/models/download`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`models download failed: ${response.status}`);
  return response.json() as Promise<ModelDownload>;
}

// BYOK key bridge (ADR-0004): the renderer keeps session memory and mirrors
// the key into the OS keychain via main-process safeStorage. Never logged.
async function setByokKey(value: string | null): Promise<boolean> {
  return ipcRenderer.invoke("byok:set", value) as Promise<boolean>;
}

async function getByokKey(): Promise<string | null> {
  return ipcRenderer.invoke("byok:get") as Promise<string | null>;
}

async function hasByokKey(): Promise<boolean> {
  return ipcRenderer.invoke("byok:has") as Promise<boolean>;
}
