# Tokens — layering and naming

> Breadcrumb 02: read this before adding a token. One minute, saves one drift.

## Layers (primitive → semantic → component)

- **Primitive** (`color.blue.600`): raw value, named by appearance. Consumed only by the system itself. Never import in components.
- **Semantic** (`color.action.primary`, `color.feedback.fail`): intent, named by purpose. This is the layer components and agents reach for.
- **Component** (optional, none yet): per-surface override like `button.bg`. Add only when one surface genuinely diverges.

References resolve one way: semantic → primitive via `{color.blue.600}`. Never reverse.

## Naming axis

`category.concept.role.state` — e.g. `color.action.primary.hover`.

- `category`: color | space | radius (what kind).
- `concept`: action | feedback | surface | fg (what domain).
- `role`: primary | pass | warn | fail | app (which intent).
- `state`: hover | active | disabled (only for interactive tokens, keep total).

Rules:
- Ban appearance words (blue, big, dark2) from semantic names. They live only in primitives.
- Every semantic token needs `$description`: one sentence saying *when* to reach for it vs a look-alike. That sentence is what the agent reads.
- `$type` lets tooling treat a color as a color, not a string.

## Pipeline (one source, many outputs)

`tokens.json` is the source of truth. Generate `tokens.css` (CSS vars) and `tokens.ts`
(typed export) from it. Never hand-edit outputs. Suggested tool: Style Dictionary,
Tokens Studio, or ~30 lines of TS. Mark outputs read-only in review.

Example output (do not edit by hand):

```css
:root {
  --color-action-primary: #2563eb;
  --color-feedback-pass: #16a34a;
}
```

## Anti-patterns (from the field audit)

1. Hex literals in components (`#3B82F6`) — agents treat each copy as independent. Use `var(--color-action-primary)`.
2. Visual-only names (`color.blue.500`) in components — agents guess. Use intent names.
3. Tokens only in Figma — agents cannot read Figma. JSON in repo wins.
4. Missing `$type`/`$description` — agents cannot disambiguate look-alikes.
