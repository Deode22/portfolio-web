# Design system — "Terminal de campo"

A fusion of a data console and the warm organic feel of a forestry
research station. The whole UI is dark-mode by default, hairline-bordered
instead of card-rounded, mono-labelled, and accented in burnt oxide (`#8C5A3A`).

## Palette

The CSS variables live in `src/app/globals.css` under `.dark` (with a light
fallback in `:root`). The shape `<html class="dark">` is set in
`src/app/layout.tsx`.

| Token                       | Hex        | Used for                                              |
| --------------------------- | ---------- | ----------------------------------------------------- |
| `--background`              | `#0A0B0A`  | page background                                       |
| `--card` / `--popover`      | `#141613`  | elevated surface (cards, map panel)                   |
| `--foreground`              | `#E8E6DF`  | primary text                                          |
| `--muted-foreground`        | `#8C8F87`  | secondary text (6.0:1 over background, AA passes)     |
| `--primary`                 | `#8C5A3A`  | CTA bg, large text (≥24px), map highlights           |
| `--primary-foreground`      | `#F5F2EC`  | text on primary bg (5.8:1 AA)                         |
| `--brand-strong`            | `#C08050`  | small text, links, focus ring (6.05:1 AA)             |
| `--accent` (shadcn's hover) | `#1E201B`  | neutral hover surface — deliberately NOT oxide        |
| `--border` / `--input`      | `#26281F`  | hairlines, never box-shadows                         |
| `--ring`                    | `#C08050`  | focus-visible outline (oxide-strong)                  |

Named surfaces, aliases over the tokens above so components read as intent
rather than as a shadcn slot:

| Token              | Alias           | Used for                                        |
| ------------------ | --------------- | ----------------------------------------------- |
| `--surface`        | `--card`        | section bands with `tone="surface"`             |
| `--surface-raised` | `--popover`     | map panel, feature detail, active states        |
| `--rule`           | `--border`      | every hairline and 1px grid gap                 |
| `--rule-strong`    | `--input`       | hairlines that must survive hover (toggle groups, outlined controls) |

### Why `--accent` is not the oxide

shadcn uses `--accent` for surfaces such as `hover:bg-accent` on ghost
buttons. If we set `--accent` to oxide, every hover becomes brown and the
single accent loses its meaning. So shadcn's `--accent` stays a near-surface
neutral, and the oxide accent gets its own variable (`--brand-strong`) plus
the standard `--primary` for hero / CTA use.

### `--brand-strong` for contrast

`#8C5A3A` on `#0A0B0A` = 3.41:1. That fails WCAG AA for body text
(4.5:1) but is still 3:1 for **large text** (≥ 24 px / ≥ 18.66 px bold)
and non-text UI components. We use:

- **`#8C5A3A` (`--primary`)** for: CTAs, big headers, map highlights,
  icon strokes, large feature labels.
- **`#C08050` (`--brand-strong`)** for: links, small mono labels, focus
  rings, "eyebrow" tags.

The two hues are within ΔE ≈ 20 of each other, so the accent "reads as
one colour family" while staying AA everywhere.

## Typography

| Role         | Family                                                  |
| ------------ | ------------------------------------------------------- |
| Headings     | **Space Grotesk** (`--font-heading`, `--font-space-grotesk`) |
| Body / UI    | **Inter** (`--font-sans`, `--font-inter`)               |
| Mono labels  | **JetBrains Mono** (`--font-mono`, `--font-jetbrains-mono`) |

All three are loaded via `next/font/google` in `src/app/layout.tsx` with
`display: swap` and applied as CSS variables. The `--font-sans /
--font-mono / --font-heading` aliases in `@theme inline` give Tailwind v4
the `font-sans`, `font-mono`, `font-heading` utilities.

Tailwind v4 `@utility` rules centralise recurring type and surface
treatment:

- `label-mono` — uppercase, wide tracking, mono, used for eyebrow labels
  and tiny captions.
- `numeric` — `font-variant-numeric: tabular-nums`. Numbers don't jiggle
  while counters animate.
- `eyebrow` — same family as `label-mono` but in `var(--brand-strong)`,
  used as a section-mark on every section.
- `headline` — heading family, negative tracking, `text-wrap: balance`.
- `prose-body` — body measure cap plus `text-wrap: pretty`.
- `pressable` — a 120 ms active-state nudge, the only tactile affordance
  in the system. Pairs with `duration-fast ease-console`.
- `rule-grid` — 1px `gap`-based grid whose gaps render as hairlines,
  replacing nested bordered cards.
- `phosphor-bleed` — the single ambient effect: a wide, very low-opacity
  oxide wash behind the hero. One per page, never repeated.

Layout caps: `max-w-shell` for the page grid and `max-w-prose` for
running text.

## Geometry

- **Radius** is set to `0.25rem` — hairline aesthetic. We avoid rounded
  cards everywhere except where shadcn computes internal radii (which remain
  small because of the small base).
- **Borders** are always 1px, hairline `var(--border)`. **No box-shadows.**
  Elevation is communicated via surface colour (card on background) and
  hairlines.

## Section rhythm

`src/data/sections.ts` is the single source of truth for section order,
index (`01`–`07`) and label. `SectionShell`
(`src/components/sections/section-shell.tsx`) renders the shared chrome:
a left rail carrying the index, the label, an optional live readout, and a
hairline that runs the full section height, plus the section's `id` and
`aria-labelledby`.

Sections alternate `tone="base"` / `tone="surface"` bands instead of
nesting cards inside cards. The shell stays a Server Component —
`SectionHeading` takes its `id` explicitly rather than reading React
context, so adding a section costs no client JS.

```tsx
<SectionShell id="projects" readout={`${sorted.length} repos`}>
  <SectionHeading id="projects">Field-tested open source.</SectionHeading>
  <SectionLede>{projectsIntro}</SectionLede>
  …
</SectionShell>
```

## Motion

Motion tokens: `duration-fast` (120 ms), `duration-base`, `duration-slow`
and a single `ease-console` curve. Use `transition-ui` rather than
`transition-all`, so hover/focus can never animate an unrelated property.

Three places where motion earns its keep:

1. **Stat counters** (`src/components/sections/hero-stat.tsx`).
   `motion` `useSpring` from 0 → value on `useInView`. Skipped via
   `useReducedMotion()` (then we skip the effect entirely — the initial
   state is the final value).
2. **Pipeline stroke** (`src/components/sections/pipeline-section.tsx`).
   `motion.line` with `pathLength` 0 → 1 on `whileInView`. Renders the
   gradient trace once per visit.
3. **Layer transitions** in the map — handled via MapLibre's own layer
   paint (no flash of absence because the GeoJSON is fetched before the
   layer is added).

`@media (prefers-reduced-motion: reduce)` zeroes all transitions globally
in `globals.css`, and motion is bypassed at the application level by
initialising state to the final value.

## Accessibility

- `lang="en"` on `<html>`.
- Skip-link to `#main` is the first focusable element in `<body>`.
- The map is `role="application"` with an `aria-label` and a keyboard-
  reachable `ToggleGroup` (`Radix ToggleGroup` handles arrow keys /
  roving tabindex).
- `FeatureTable` renders identical data as HTML tables, so screen reader
  users and visitors with no WebGL still get full content.
- `:focus-visible` outline is 2 px solid `var(--ring)` (oxide-strong) with
  2 px offset, applied via `@layer base` so every focusable element gets it.
  Primitives must **not** add their own ring — `Button`, `Toggle` and
  `ToggleGroup` all rely on that one base outline, which is why they carry
  `outline-none` without replacing it.
- `prefers-reduced-motion: reduce` collapses all animations and transitions.
- A missing binary asset renders as a quiet `// no preview` plate from
  `AssetImage`, never as a dashed placeholder or broken image.
