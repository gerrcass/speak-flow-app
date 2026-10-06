// Electron main: spawns the Python sidecar and supervises GET /health (ADR-0002).
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { waitForSidecar } from "./sidecar";

let sidecar: ChildProcess | null = null;

const PORT = Number(process.env.SIDECAR_PORT ?? "4317");
const TOKEN = process.env.SIDECAR_TOKEN ?? randomUUID();
process.env.SIDECAR_PORT = String(PORT);
process.env.SIDECAR_TOKEN = TOKEN;

function sidecarEntry(): string {
  if (process.env.SIDECAR_ENTRY) return process.env.SIDECAR_ENTRY;
  return join(__dirname, "..", "..", "sidecar", "main.py");
}

async function startSidecar(): Promise<void> {
  const python = process.env.SIDECAR_PYTHON ?? "python3";
  sidecar = spawn(python, [sidecarEntry()], {
    env: { ...process.env, SIDECAR_TOKEN: TOKEN, SIDECAR_PORT: String(PORT) },
    stdio: "ignore",
  });
  await waitForSidecar(PORT, TOKEN, { timeoutMs: 20000, intervalMs: 250 });
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 900,
    height: 640,
    webPreferences: { preload: join(__dirname, "preload.js") },
  });
  if (process.env.ELECTRON_DEV) {
    void window.loadURL("http://localhost:5173");
  } else {
    void window.loadFile(join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  await startSidecar();
  createWindow();
});

app.on("before-quit", () => {
  sidecar?.kill();
});
