// Seam (d): CI hex-gate. Fails when apps/desktop/src holds hardcoded hex.
// RED test: fails until apps/desktop/scripts/hex-gate.mjs exists.
import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const gate = new URL("../scripts/hex-gate.mjs", import.meta.url);

test("passes on the real src tree (no hardcoded hex outside generated outputs)", async () => {
  await execFileAsync(process.execPath, [gate.pathname]);
});

test("fails when a scanned file contains a hex literal", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-"));
  await writeFile(join(dir, "Bad.tsx"), "const c = '#ff0000';\n");
  await assert.rejects(execFileAsync(process.execPath, [gate.pathname, "--dir", dir]));
});
