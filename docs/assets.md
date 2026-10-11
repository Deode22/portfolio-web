# Assets

This project ships with most binary assets still missing — the brief
explicitly forbids breaking the build because a CV, project screenshot or
GeoJSON isn't available yet. The `AssetPlaceholder` pattern makes that
honour-system practical.

## `sync-assets.mjs` — the single source of truth

```bash
npm run assets:sync           # explicit
npm run dev                   # implicit via the predev hook
npm run build                 # implicit via the prebuild hook
```

The script:

1. Walks `public/` for a known set of expected paths (the
   `expectedAssets` table in `scripts/sync-assets.mjs`).
2. Classifies each as `present`, `missing` or `directory`.
3. Writes `src/data/assets.generated.ts` with a typed
   `Record<path, Asset>` so consumers can do
   `assets["projects/rusle-cli.png"]?.status === "present"`.
4. Copies MapLibre's prebuilt worker + shared chunk to `public/maplibre/`.

To add a new asset: add the path to `expectedAssets` and `kind`. The
manifest updates on the next script run; the next page render reads it.

## `<AssetImage />` — hairline-bordered placeholder

`src/components/ui/asset-image.tsx` is the only place the rest of the app
should render binary file previews. It:

- Reads `assets[path]` once.
- Renders `next/image` when the file is `present`.
- Renders an `AssetPlaceholder` block (border-dashed, mono caption
  `MISSING: <path>`, `// hint: <label>`) when `missing`.

So missing thumbnails never break the page — they show a labelled box.

## Asset status right now (as of bootstrap)

| Path                                              | Status          |
| ------------------------------------------------- | --------------- |
| `documents/Daniel_Fernandez_CV.pdf`               | missing → TODO  |
| `images/avatar.jpg`                               | present         |
| `images/og-image.png`                             | missing → TODO  |
| `projects/rusle-cli.png`                          | missing → TODO  |
| `projects/extractor-aemet.png`                    | missing → TODO  |
| `projects/prophet-predicting.png`                 | missing → TODO  |
| `projects/digital-twin-lidar.png`                 | missing → TODO  |
| `geojson/*.geojson`                               | present (mock)  |
| `maplibre/maplibre-gl-{worker,shared}.mjs`        | present (mirrored) |

When the CV is dropped into `public/documents/`, `npm run dev` (or
`npm run assets:sync`) regenerates the manifest, the hero "Download CV"
button stops being disabled, and the placeholder disappears from the
bento in `projects.ts`.

## Mock GeoJSON

The four files in `public/geojson/` are **mock data**:

- Coordinates are centred on Madrid / Sierra de Guadarrama / El Pardo.
- Three features each; "looks plausible" data values.
- `public/geojson/README.md` documents the intent.

Replace them with real datasets before publishing. The shape of the
GeoJSON `properties` for each layer is declared in
`src/data/map-layers.ts` as `MapLayerProperty[]` — keep the property
names in sync when you swap files, or update the layer definition to
match the new source.
