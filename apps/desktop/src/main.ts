// Electron main: spawns the Python sidecar and supervises GET /health (ADR-0002).
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { app, BrowserWindow, ipcMain } from "electron";
import { listAttempts, openAttemptsDb, saveAttempt, type AttemptRow } from "./freetalk/store";
import { listDueCards } from "./srs/cards";
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

let db: DatabaseSync | null = null;

// Attempts DB lives in userData so history survives restarts; SPEAK_FLOW_DB
// overrides the file path (used by tests with a tmp file).
function attemptsDb(): DatabaseSync {
  if (db === null) {
    db = openAttemptsDb(process.env.SPEAK_FLOW_DB ?? join(app.getPath("userData"), "speak-flow.db"));
  }
  return db;
}

function registerAttemptHandlers(): void {
  ipcMain.handle("attempts:save", (_event, row: AttemptRow) => {
    saveAttempt(attemptsDb(), row);
    return true;
  });
  ipcMain.handle("attempts:list", () => listAttempts(attemptsDb()));
  ipcMain.handle("srs:list-due", (_event, now: string) => listDueCards(attemptsDb(), now));
}

app.whenReady().then(async () => {
  registerAttemptHandlers();
  await startSidecar();
  createWindow();
  void checkForUpdates();
});

// electron-updater (ticket #6): check the stub feed on start. The feed URL
// lives in package.json build.publish; SPEAK_FLOW_UPDATE_URL overrides it
// (CI/staging). Failures are swallowed: offline-first means updates are best
// effort, never a startup blocker.
async function checkForUpdates(): Promise<void> {
  try {
    const { autoUpdater } = await import("electron-updater");
    const override = process.env.SPEAK_FLOW_UPDATE_URL;
    if (override) autoUpdater.setFeedURL({ provider: "generic", url: override });
    await autoUpdater.checkForUpdatesAndNotify();
  } catch {
    // No feed reachable (dev/offline): the app runs on as usual.
  }
}

app.on("before-quit", () => {
  sidecar?.kill();
  db?.close();
  db = null;
});
