// Bundled Content Pack allowlist + path helper (ticket #3). Renderer-safe:
// no Node-only imports, so the panel, the preload bridge, and tests share
// this single module (preload imports it extensionless like main.ts imports
// sidecar.ts; renderer and tests use the `.ts` extension). Node's fs accepts
// forward slashes on every platform, so no node:path join is needed.
// Glossary: Content Pack.

export const BUNDLED_PACK_FILES = ["phrases_100.json", "prompts_30.json", "minimal_pairs.json"] as const;

export type BundledPackFile = (typeof BUNDLED_PACK_FILES)[number];

export function isBundledPackFile(name: string): name is BundledPackFile {
  return (BUNDLED_PACK_FILES as readonly string[]).includes(name);
}

export function resolvePackPath(baseDir: string, name: string): string {
  if (!isBundledPackFile(name)) {
    throw new Error(`unknown Content Pack file: ${name}`);
  }
  const base = baseDir.endsWith("/") ? baseDir : `${baseDir}/`;
  return `${base}${name}`;
}
