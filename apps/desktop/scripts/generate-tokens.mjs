// Generates tokens.css + tokens.ts from docs/design-system/tokens/tokens.json.
// Source of truth is tokens.json (W3C $value/$type/$description, {curly} refs).
// Never hand-edit the outputs; edit tokens.json, then run `pnpm tokens:build`.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HEADER = "/* generated, do not edit — run `pnpm tokens:build` instead */";

function flatten(node, path = [], out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    if (value && typeof value === "object" && "$value" in value) {
      out.set([...path, key].join("-"), value.$value);
    } else if (value && typeof value === "object") {
      flatten(value, [...path, key], out);
    }
  }
  return out;
}

function resolveValue(raw) {
  return raw.replace(/\{([^}]+)\}/g, (_, ref) => `var(--${ref.replace(/\./g, "-")})`);
}

function toCss(entries) {
  const lines = [HEADER, ":root {"];
  for (const [name, raw] of entries) lines.push(`  --${name}: ${resolveValue(raw)};`);
  lines.push("}");
  return lines.join("\n") + "\n";
}

function toTs(entries) {
  const lines = [HEADER, "export const tokens = {"];
  for (const [name] of entries) lines.push(`  "${name}": "var(--${name})",`);
  lines.push('} as const;', "", "export type TokenName = keyof typeof tokens;", "");
  return lines.join("\n");
}

function parseArgs(argv) {
  const out = { out: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") out.out = resolve(argv[i + 1]);
  }
  return out;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "..", "..", "..");
  const source = join(root, "docs", "design-system", "tokens", "tokens.json");
  const { out } = parseArgs(process.argv.slice(2));
  const outDir = out ?? join(here, "..", "generated");
  const raw = JSON.parse(await readFile(source, "utf8"));
  const entries = flatten(raw);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "tokens.css"), toCss(entries));
  await writeFile(join(outDir, "tokens.ts"), toTs(entries));
  console.log(`tokens: ${entries.size} written to ${outDir}`);
}

await main();
