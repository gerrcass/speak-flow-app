# 0003 shadcn-style + Tailwind + W3C tokens as the design system

New Electron + React app with no legacy styles. We adopt shadcn-style plain-TSX components + Tailwind CSS consuming W3C Design Tokens (`docs/design-system/tokens/tokens.json` as single source). This is the DesignSystems.one 2026 default for new builds: agents read the TSX, get type errors on invented props, and reach for semantic `var(--color-*)` instead of hex.

## Considered Options

- MUI / Chakra: heavier runtime theming, prop APIs less strict for agents, harder to own in-repo.
- Raw CSS modules without tokens: no machine-readable contract, drift within a sprint.
- Full custom system from scratch: overkill for MVP; shadcn gives typed patterns day one.

## Consequences

- All UI work starts from `docs/design-system/README.md` reading order.
- CI must fail on hex literals in `apps/desktop/src` (day-6 lint from the methodology).
- MCP server (`list-tokens`, `find-component`) is deferred until ≥5 components exist.
