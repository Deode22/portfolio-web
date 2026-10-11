# Daniel Fernández Villanueva — Portfolio

The personal portfolio of Daniel Fernández Villanueva, a geospatial data
engineer and forestry domain expert. It is a single-page application built on
Next.js 16 that presents professional work as a field instrument rather than a
brochure: dark, hairline-bordered, mono-labelled, and authored in a single
"Terminal de campo" art direction.

The site carries three interlocking narratives — professional track record,
selected delivery work, and a live map sandbox of real Earth observation
products — and binds them together with a data-driven content layer so that
copy, metrics, and spatial configuration are never duplicated in markup.

## Art direction

The visual language fuses a data console with the warm, organic feel of a
forestry research station. It is dark-mode by default and rejects rounded
cards in favour of 1px hairlines. A burnt-oxide accent (`#8C5A3A`) is reserved
for interactive and large-scale typography, while a lighter sibling
(`#C08050`) carries small labels and links so that every text pairing clears
WCAG AA. The basemap is desaturated satellite imagery, so the map reads as a
muted layer under the interface rather than a competing photograph.

Every section frames itself as an instrument: an indexed rail, a mono caption,
and figures rendered with tabular numerals. Motion is used only where it
carries information — counters that count into view, a pipeline whose stroke
draws as it is read — and collapses entirely under
`prefers-reduced-motion`.

## The field map

The map is the centrepiece. It is a client-only MapLibre GL canvas that mounts
after hydration and offers four switchable earth-observation layers, each
described with the same readout — variable, footprint, grid, scale and
provenance:

| Layer | Variable | Provenance |
| --- | --- | --- |
| Erosion (RUSLE) | Soil loss, `t/ha·yr` | Real GeoTIFF, log-scaled |
| Hydric Risk & Moisture | `ΔNDMI` anomaly | Real GeoTIFF, divergent ramp |
| Disturbance & Severity | dNBR severity tiers 0–3 | Real GeoTIFF, categorical |
| Canopy Structure & LiDAR | Canopy height (CHM) | PNOA ALS point clouds (IGN Spain) |

Three of the layers are raster products baked at build time from their source
GeoTIFFs into colormapped PNGs over a known WGS84 footprint. The LiDAR layer
adds a canopy height model as its visual base and layers stand polygons over
it at zero opacity: the stands are hit-test only, so a click on the canopy
opens a panel of structural metrics — dominant species, canopy height and
cover, sampling density and an estimated timber volume derived from an
inverted height–diameter curve and a published additive biomass system.

Vector overlays carry per-feature attributes into a side rail and a plain-HTML
feature table, which stays legible even when WebGL is unavailable. A feature
detection pass reports the canvas as live, degraded or in fallback, and the
table guarantees the data is never locked behind a GPU.

## Page composition

The route is composed of seven indexed sections in a fixed order, all governed
by one registry so that the navigation and the per-section rail can never
drift apart:

1. **About** — name, role, value proposition and a strip of audited figures.
2. **Field Map** — the four-layer spatial sandbox described above.
3. **Projects** — a bento of delivery work, from a containerized erosion
   screening engine to field-calibrated plantation models.
4. **Track Record** — professional experience across the Spanish National
   Forest Inventory, forestry-carbon consultancy and university R&D.
5. **Pipeline** — the five-stage flow from field ground truth to production
   delivery, drawn as it scrolls into view.
6. **Stack** — the tooling relied upon, grouped by domain.
7. **Contact** — direct channels.

## Architecture

The project separates content, structure and presentation cleanly:

- **Content is data.** Every string, metric and spatial configuration lives in
  `src/data/*.ts`. Sections read from those modules and never hard-code copy,
  which makes the site cheap to re-word and to re-shape without touching
  markup.
- **Server by default, client on demand.** The page and its section chrome are
  server components. Only the pieces that genuinely need the browser — the map
  canvas, the counters, the animated pipeline and the header's active-section
  tracking — are client components.
- **The map owns its lifecycle.** A single client component owns the MapLibre
  instance, swaps its source when the active layer changes, and tears it down
  on unmount. MapLibre is loaded through a mount-gated dynamic import after
  hydration, which sidesteps the hydration mismatches that server-rendered map
  libraries otherwise produce.
- **Assets are inventoried.** A build-time manifest tracks every binary
  referenced by the data layer — CV, portrait, project previews, the social
  card and the GeoJSON layers. Present assets render directly; absent ones
  degrade to a hairline placeholder rather than a broken image, so the site is
  always whole.
- **Rasters are baked ahead of time.** Because neither MapLibre nor the browser
  reads GeoTIFFs directly, each raster layer is converted once at build time
  into a colormapped PNG alongside a generated manifest of bounds, ramp and
  statistics. No tile service sits behind the map.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| UI runtime | React 19 |
| Styling | Tailwind CSS v4, shadcn/ui (new-york) over Radix primitives |
| Mapping | MapLibre GL JS 6, no API key |
| Motion | Motion 13 |
| Language | TypeScript 5 (strict) |
| Geoprocessing | Python — laspy, rasterio, and the project's own CLI tooling |

## Project documentation

Deeper notes are kept alongside the code, covering the reasoning behind the
build rather than how to operate it:

- [`docs/architecture.md`](./docs/architecture.md) — structure, data flow and
  the server/client boundary.
- [`docs/design-system.md`](./docs/design-system.md) — the "Terminal de campo"
  palette, typography, motion and accessibility rules.
- [`docs/map.md`](./docs/map.md) — the mapping stack, basemap, layer model and
  spatial data sources.
- [`docs/assets.md`](./docs/assets.md) — the asset manifest and the
  placeholder pattern that keeps missing files safe.
