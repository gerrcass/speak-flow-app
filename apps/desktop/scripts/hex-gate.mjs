// Hex-gate (ADR-0003): fail when apps/desktop/src holds hardcoded hex literals.
// Components must use semantic var(--*) tokens; generated outputs live in
// apps/desktop/generated (outside src) so this scan needs no exclusions.
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function parseArgs(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dir") return resolve(argv[i + 1]);
  }
  return new URL("../src", import.meta.url).pathname;
}

const dir = parseArgs(process.argv.slice(2));
const offenders = [];
for await (const file of walk(dir)) {
  if (![...EXTENSIONS].some((ext) => file.endsWith(ext))) continue;
  const text = await readFile(file, "utf8");
  if (HEX.test(text)) offenders.push(file);
}

if (offenders.length > 0) {
  console.error(`hex-gate: hardcoded hex in ${offenders.length} file(s):`);
  for (const file of offenders) console.error(`  ${file}`);
  process.exit(1);
}
console.log(`hex-gate: clean (${dir})`);
