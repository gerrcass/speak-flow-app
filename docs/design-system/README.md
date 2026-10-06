# Design System — AI-Ready from Day Zero

> Learning trail: this folder is a didactic breadcrumb trail. Each file explains
> one idea from https://www.designsystems.one/ai-ready and shows how speak-flow-app
> applies it. You can learn the methodology just by reading this folder in order.

## Why this exists

In 2026 the bottleneck moved from generation to integration. LLMs generate decent UI,
but the receiving design system drifts unless it is machine-readable. Following
DesignSystems.one, AI-ready means three pillars:

1. **Tokens** an agent can parse without rendering anything (W3C format).
2. **MCP server** (later) so agents query tokens/components at edit time.
3. **Component contracts** agents cannot violate without a type error.

We implement pillar 1 fully now, pillar 3 partially (one contract + rule), and leave
pillar 2 as a documented next step. Each step is independently shippable.

## Reading order (start here)

1. `tokens/tokens.json` — the single source of truth (W3C `$value`, `$type`, `$description`).
2. `tokens/README.md` — layering (primitive → semantic → component) and naming axis.
3. `components/Button.mdx` — typed contract with discriminated-union props + runnable sample.
4. `../../llms.txt` — entry map agents actually read (repo root).
5. `../../docs/adr/0003-shadcn-tailwind-w3c-tokens.md` — why shadcn + Tailwind + W3C for this project.

## Choice

**shadcn/ui-style + Tailwind CSS + W3C Design Tokens**, owned in-repo as plain TSX.

Why (methodology-mapped):
- shadcn ships components *into* the repo as plain TSX. Agents read them, modify them,
  and get type errors when wrong. DesignSystems.one calls this "AI-native by accident"
  and the default for new builds in 2026.
- Tailwind consumes CSS vars (`var(--color-action-*)`), so generated UI cannot drift
  into hex literals if the CI lint passes.
- W3C tokens give `$description` ("when to use this token vs a look-alike"), which is
  what lets an agent pick `color.action.primary` over inventing `#4F46E5`.
- Discriminated unions (`size: 'sm' | 'md' | 'lg'`) reject invented props at type-check.
- Fits Electron + React: no native dependency, works with WebView/Chromium, themeable
  for practice states (idle / recording / scored green-yellow-red).

What we deliberately skip for now: full MCP server, Figma Code Connect, registry endpoint.
See "Next steps" in the ADR.

## The six steps (DesignSystems.one structure guide) and our status

- [x] 01 Layer tokens (primitive → semantic, component sparingly).
- [x] 02 Name by intent (`category.concept.role.state`, no appearance words in semantic).
- [x] 03 Author W3C (`$value` + `$type` + `$description`, `{curly}` refs).
- [x] 04 One source, many outputs (`tokens.json` → `tokens.css` + typed TS, generated only).
- [x] 05 LLM-readable docs (`llms.txt` + READMEs + MDX with code, never screenshots).
- [ ] 06 Queryable then locked (MCP later; CI hex-gate now).

## Breadcrumb rule

As the app grows, leave a one-paragraph note here per design decision (token added,
variant added, rule changed) with *why*. Never stop development to write docs —
just drop the crumb.

## Crumbs

- 01 app shell: generated outputs live in `apps/desktop/generated/` (outside `src/`) so the CI hex-gate can scan `src/` with zero exclusions; `size="lg"` derives from tokens via `calc(var(--space-inset-md) * 1.5)` instead of a new token.
