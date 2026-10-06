// Preload bridge: renderer asks the sidecar /health through here.
// Reads SIDECAR_PORT/SIDECAR_TOKEN from the main-process environment.
import { contextBridge, ipcRenderer } from "electron";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isBundledPackFile, resolvePackPath } from "./content/pack-files";
import type { AttemptRow } from "./freetalk/store";

async function sidecarHealth(): Promise<string> {
  const port = process.env.SIDECAR_PORT ?? "4317";
  const token = process.env.SIDECAR_TOKEN ?? "";
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
});

export interface SttConfig {
  port: number;
  token: string;
}

async function sttConfig(): Promise<SttConfig> {
  return {
    port: Number(process.env.SIDECAR_PORT ?? "4317"),
    token: process.env.SIDECAR_TOKEN ?? "",
  };
}

function contentBaseDirs(): string[] {
  const resources = (process as unknown as { resourcesPath?: string }).resourcesPath;
  return [
    ...(resources ? [join(resources, "content")] : []),
    join(__dirname, "..", "..", "..", "content"),
    join(process.cwd(), "content"),
    join(process.cwd(), "..", "..", "content"),
  ];
}

async function readContentPack(name: string): Promise<string> {
  if (!isBundledPackFile(name)) throw new Error(`unknown Content Pack file: ${name}`);
  for (const base of contentBaseDirs()) {
    try {
      return await readFile(resolvePackPath(base, name), "utf8");
    } catch {
      // Try the next candidate directory.
    }
  }
  throw new Error(`Content Pack file not found: ${name}`);
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
