// Seam (c): NSIS installer ships no bundled models + updater feed stub.
// ADR-0002: Electron installer; models download on first run into the OS
// data dir, never bundled. RED: fails until package.json carries the
// electron-builder build config with NSIS + model exclusion.
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const pkgPath = new URL("../package.json", import.meta.url);

async function buildConfig() {
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  assert.ok(pkg.build, "package.json needs an electron-builder build config");
  return pkg.build;
}

test("installer targets NSIS on Windows", async () => {
  const build = await buildConfig();
  const targets = build.win?.target ?? build.targets;
  assert.ok(
    JSON.stringify(targets).includes("nsis"),
    `expected an nsis target, got ${JSON.stringify(targets)}`,
  );
});

test("installer bundles no model weights", async () => {
  const build = await buildConfig();
  const text = JSON.stringify(build);
  assert.match(text, /models/i, "config must mention models to exclude them");
  // Only inclusion globs (entries without a leading `!`) may ship files:
  // no included entry may pull model weights into the installer.
  const included = (build.files ?? []).filter((glob) => !glob.startsWith("!"));
  assert.ok(
    included.every(
      (glob) => !/models|\.pt$|\.bin$|\.onnx$/.test(glob),
    ),
    `no weight globs may ship, got ${JSON.stringify(included)}`,
  );
  const excluded = (build.files ?? []).filter((glob) => glob.startsWith("!"));
  assert.ok(
    excluded.some((glob) => glob.includes("models")),
    `models dir must be explicitly excluded, got ${JSON.stringify(excluded)}`,
  );
});

test("electron-updater feed URL is configured", async () => {
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const build = pkg.build ?? {};
  const url = build.publish?.url ?? process.env.SPEAK_FLOW_UPDATE_URL ?? "";
  assert.ok(
    typeof url === "string" && url.length > 0,
    "publish.url stub (or SPEAK_FLOW_UPDATE_URL) must configure the update feed",
  );
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(deps["electron-updater"], "electron-updater must be a dependency");
});
