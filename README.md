# Daniel Fernández Villanueva — Portfolio

Single-page portfolio for Daniel Fernández Villanueva (Geospatial Data Engineer
· Forestry Domain Expert). Built on Next.js 16 with a "Terminal de campo"
art direction: dark, hairline-bordered, mono-labelled, with a burnt-oxide
(`#8C5A3A`) accent and desaturated ArcGIS World Imagery for the map.

| Build          | Status                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| TypeScript     | `npm run typecheck`                                                        |
| Lint (ESLint 9)| `npm run lint`                                                             |
| Production     | `npm run build`                                                            |
| Dev            | `npm run dev` (auto-runs `predev` to sync assets and the MapLibre worker)  |

## Quick start

```bash
npm install
npm run dev       # opens http://localhost:3000
```

A **`predev`** hook calls `scripts/sync-assets.mjs`:

1. Walks `public/` and writes `src/data/assets.generated.ts`.
2. Copies `node_modules/maplibre-gl/dist/maplibre-gl-{worker,shared}.mjs` to
   `public/maplibre/` so the map sandbox can boot in a Turbopack environment.

## Documentation

Everything deeper lives in [`docs/`](./docs/README.md):

- [architecture.md](./docs/architecture.md) — how the project is structured
  and why.
- [design-system.md](./docs/design-system.md) — "Terminal de campo"
  palette, typography, motion and accessibility rules.
- [map.md](./docs/map.md) — MapLibre style, ArcGIS basemap, fallback paths,
  swapping mock GeoJSON for real data.
- [assets.md](./docs/assets.md) — the asset manifest and the
  `AssetPlaceholder` pattern that makes missing files safe.

For ambient state (current TODOs, what's blocked, what is mocked) see
[`.opencode/memory.md`](./.opencode/memory.md).

## Stack at a glance

- **Next.js 16.3.6** App Router + Turbopack + `LayoutProps<"/">` typed routes.
- **React 19.2.8**.
- **Tailwind v4** (`@theme inline`, `@utility`).
- **shadcn/ui new-york** over **Radix** primitives
  (`@radix-ui/react-slot | separator | tabs | tooltip | toggle-group`).
- **lucide-react v1** (`Code`, `Briefcase`, `MapPin`, … — brand icons are
  not shipped in v1).
- **MapLibre GL JS 6** (no API key, deduped ESM worker in `public/`).
- **Motion 13** (`motion/react`) for the count-up + pipeline stroke +
  accordion.

## Section map

1. `#hero` — name, title, value prop, stat strip with tabular-nums counters.
2. `#map` — four-layer GeoJSON sandbox over a desaturated satellite basemap.
3. `#projects` — bento grid (`rusle-cli` big, 2 mediums, digital twin).
4. `#pipeline` — five-stage horizontal flow with stroke-draw animation.
5. `#stack` — four categories of tools, separated by hairlines (no cards).
6. `#contact` — mailto / GitHub / LinkedIn / location.

## What is mocked

These live under TODO markers in code and in the manifest:

- `documents/Daniel_Fernandez_CV.pdf` — drop the real CV into `public/documents/`.
- `images/og-image.png`, `images/avatar.jpg` — drop into `public/images/`.
- `projects/{rusle-cli,extractor-aemet,prophet-predicting,digital-twin-lidar}.png`
  — drop previews into `public/projects/`.
- `public/geojson/*.geojson` — mock demo data, replace before publishing.

`scripts/sync-assets.mjs` regenerates `src/data/assets.generated.ts` so the
UI shows a hairline `MISSING: <path>` placeholder instead of a broken
`<Image />`, and the placeholders **disappear on their own** the moment the
real files land in `public/`.
