// Seam (a): tokens.json -> tokens.css + typed TS generation.
// RED test: fails until apps/desktop/scripts/generate-tokens.mjs exists.
import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const script = new URL("../scripts/generate-tokens.mjs", import.meta.url);

test("generates tokens.css with semantic vars and no hand-edit header", async () => {
  const out = await mkdtemp(join(tmpdir(), "tokens-"));
  await execFileAsync(process.execPath, [script.pathname, "--out", out]);
  const css = await readFile(join(out, "tokens.css"), "utf8");
  assert.match(css, /generated, do not edit/);
  assert.match(css, /--color-action-primary:\s*var\(--color-blue-600\)/);
  assert.match(css, /--color-blue-600:\s*#2563eb/);
  assert.match(css, /--space-inset-md:\s*16px/);
  assert.match(css, /--radius-control-sm:\s*6px/);
});

test("generates typed TS export with token names", async () => {
  const out = await mkdtemp(join(tmpdir(), "tokens-"));
  await execFileAsync(process.execPath, [script.pathname, "--out", out]);
  const ts = await readFile(join(out, "tokens.ts"), "utf8");
  assert.match(ts, /generated, do not edit/);
  assert.match(ts, /color-action-primary/);
  assert.match(ts, /export type TokenName/);
});
