// Electron main: spawns the Python sidecar and supervises GET /health (ADR-0002).
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { unlink, readFile, writeFile } from "node:fs/promises";
import type { DatabaseSync } from "node:sqlite";
import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import { listAttempts, openAttemptsDb, saveAttempt, type AttemptRow } from "./freetalk/store";
import { isBundledPackFile, resolvePackPath } from "./content/pack-files";
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

// Sidecar connection info + Content Pack file reads live in main because the
// sandboxed preload has no Node.js access (no process.env, fs, or path).
// The renderer reaches them through the preload bridge only.
function contentBaseDirs(): string[] {
  const resources = (process as unknown as { resourcesPath?: string }).resourcesPath;
  return [
    ...(resources ? [join(resources, "content")] : []),
    join(__dirname, "..", "..", "..", "content"),
    join(process.cwd(), "content"),
    join(process.cwd(), "..", "..", "content"),
  ];
}

function registerSidecarHandlers(): void {
  ipcMain.handle("sidecar:config", () => ({ port: PORT, token: TOKEN }));
  ipcMain.handle("content:read", async (_event, name: unknown) => {
    if (typeof name !== "string" || !isBundledPackFile(name)) {
      throw new Error(`unknown Content Pack file: ${name}`);
    }
    for (const base of contentBaseDirs()) {
      try {
        return await readFile(resolvePackPath(base, name), "utf8");
      } catch {
        // Try the next candidate directory.
      }
    }
    throw new Error(`Content Pack file not found: ${name}`);
  });
}

function registerAttemptHandlers(): void {  ipcMain.handle("attempts:save", (_event, row: AttemptRow) => {
    saveAttempt(attemptsDb(), row);
    return true;
  });
  ipcMain.handle("attempts:list", () => listAttempts(attemptsDb()));
  ipcMain.handle("srs:list-due", (_event, now: string) => listDueCards(attemptsDb(), now));
}

let byokMemoryKey: string | null = null;

// BYOK key storage (ADR-0004, ticket #3): OS keychain via safeStorage when
// encryption is available, else session memory only. The encrypted blob lives
// in userData (mode 0600); the key itself is never logged, never bundled,
// never committed.
function byokKeyFile(): string {
  return join(app.getPath("userData"), "byok-key.bin");
}

function byokKeychainAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function registerByokHandlers(): void {
  ipcMain.handle("byok:set", async (_event, value: unknown) => {
    const next = typeof value === "string" && value.length > 0 ? value : null;
    byokMemoryKey = next;
    if (next === null) {
      try {
        await unlink(byokKeyFile());
      } catch {
        // Nothing stored: already memory-only.
      }
      return true;
    }
    if (byokKeychainAvailable()) {
      try {
        await writeFile(byokKeyFile(), safeStorage.encryptString(next), { mode: 0o600 });
      } catch {
        // Session-memory copy above still serves this run.
      }
    }
    return true;
  });
  ipcMain.handle("byok:get", async () => {
    if (byokMemoryKey !== null) return byokMemoryKey;
    if (!byokKeychainAvailable()) return null;
    try {
      const decrypted = safeStorage.decryptString(await readFile(byokKeyFile()));
      byokMemoryKey = decrypted.length > 0 ? decrypted : null;
      return byokMemoryKey;
    } catch {
      return null;
    }
  });
  ipcMain.handle("byok:has", async () => {
    if (byokMemoryKey !== null) return true;
    if (!byokKeychainAvailable()) return false;
    try {
      await readFile(byokKeyFile());
      return true;
    } catch {
      return false;
    }
  });
}

app.whenReady().then(async () => {
  registerSidecarHandlers();
  registerAttemptHandlers();
  registerByokHandlers();
  await startSidecar();
  createWindow();
  if (app.isPackaged) void checkForUpdates();
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
