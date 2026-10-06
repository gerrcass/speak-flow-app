// Content Pack schema (ticket #3). Glossary: Content Pack, Reference,
// Prompt. A Content Pack is curated local JSON of References and Prompts
// tagged by CEFR level + focus (th, ed, stress). Validation lives here;
// minting the ContentPackVerified proof lives in proofs/ (ADR-0005).
import { z } from "zod";

export const LevelSchema = z.enum(["A1", "A2", "B1"]);
export type Level = z.infer<typeof LevelSchema>;

export const FocusTagSchema = z.enum(["th", "ed", "stress"]);
export type FocusTag = z.infer<typeof FocusTagSchema>;

export const ReferenceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  level: LevelSchema,
  tags: z.array(FocusTagSchema).min(1),
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const PromptSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  level: LevelSchema,
});
export type Prompt = z.infer<typeof PromptSchema>;

export const MinimalPairSchema = z.object({
  id: z.string().min(1),
  pair: z.tuple([z.string().min(1), z.string().min(1)]),
  focus: z.union([FocusTagSchema, z.enum(["vowel"])]),
  exampleA: z.string().min(1),
  exampleB: z.string().min(1),
});
export type MinimalPair = z.infer<typeof MinimalPairSchema>;

export const ContentPackSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    kind: z.literal("phrases"),
    items: z.array(ReferenceSchema).min(1),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("prompts"),
    items: z.array(PromptSchema).min(1),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("minimal-pairs"),
    items: z.array(MinimalPairSchema).min(1),
  }),
]);
export type ContentPack = z.infer<typeof ContentPackSchema>;

export type PackKind = ContentPack["kind"];

// Wrap sidecar POST /content/generate items (References without ids) into a
// verifiable phrases Content Pack. Null when the items do not validate, so
// generated content goes through the same proof gate as bundled packs.
export function toPhrasesPack(id: string, items: unknown): ContentPack | null {
  if (!Array.isArray(items)) return null;
  const withIds = items.map((item, index) => {
    if (typeof item !== "object" || item === null) return item;
    const record = item as Record<string, unknown>;
    return { id: `gen-${index + 1}`, ...record };
  });
  const parsed = ContentPackSchema.safeParse({ id, kind: "phrases", items: withIds });
  if (!parsed.success) return null;
  return parsed.data;
}
