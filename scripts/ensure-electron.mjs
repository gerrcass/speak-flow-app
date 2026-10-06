// pnpm 9.15+ does not run dependency postinstall scripts by default, so the
// Electron binary (downloaded by electron/install.js) is missing after a
// fresh `pnpm install`. Running it from our own postinstall is deterministic
// across pnpm versions and CI. Idempotent: install.js skips when dist exists.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const pnpmDir = join(process.cwd(), "node_modules", ".pnpm");
let installed = false;
for (const entry of readdirSync(pnpmDir)) {
  if (!entry.startsWith("electron@")) continue;
  const pkgDir = join(pnpmDir, entry, "node_modules", "electron");
  const binary = join(pkgDir, "dist", "electron");
  const installer = join(pkgDir, "install.js");
  if (!existsSync(binary) && existsSync(installer)) {
    console.log(`[ensure-electron] downloading binary for ${entry}...`);
    execFileSync(process.execPath, [installer], { stdio: "inherit" });
    installed = true;
  } else if (existsSync(binary)) {
    installed = true;
  }
}
if (!installed) console.log("[ensure-electron] no electron package found, skipping");
