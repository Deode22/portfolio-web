# Map sandbox

The `#map` section is an interactive four-layer visualisation — three baked
raster overlays plus the LiDAR tab, a raster with a clickable GeoJSON
overlay — over a desaturated satellite basemap. Everything in here lives
under `src/components/map/` and `src/lib/maplibre-style.ts`.

## Why MapLibre and not an image or a `<canvas>` snippet

We need real feature querying per click (mouse coords → `properties`),
draw a per-layer legend with paint specs, and serve on no-API-key tiles.
MapLibre is the cheapest open-source choice and exposes the layer / source /
paint API the brief calls for.

## Basemap

```ts
// src/lib/maplibre-style.ts
tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]
```

`server.arcgisonline.com` serves ArcGIS World Imagery as a raw XYZ tile
endpoint — **no API key, no rate limit on the public tier**. The raster is
attenuated to fit the Terminal de campo palette:

```js
paint: {
  "raster-saturation":     -0.55,
  "raster-brightness-min":  0.05,
  "raster-brightness-max":  0.62,
  "raster-contrast":        0.15,
}
```

That yields a muted, slightly-warm satellite picture on which oxide-tinted
GeoJSON layers read at a glance. To swap providers, change the tile URL in
`buildMapStyle()` — the rest of the system doesn't care.

## Worker URL

MapLibre GL JS v6 ships its worker as a prebuilt ESM file:

```
node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs
```

It imports `./maplibre-gl-shared.mjs` relative to itself, so on the server
you can't pass a `?url` import like you would in Vite. Instead:

1. `scripts/sync-assets.mjs` copies both files into `public/maplibre/`.
2. `src/components/map/map-canvas.tsx` calls
   `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")` at **module scope**
   (with a `typeof window` guard), so the URL is set before the first
   `new MLMap(...)`.

If you change the location of either file, update both the script and
`map-canvas.tsx`.

## Layer toggle

Four layers, single-select. `MapLayer` is a **discriminated union** on
`kind`, so consumers narrow instead of guessing:

| id           | kind    | source                                                     |
| ------------ | ------- | ---------------------------------------------------------- |
| `hydric`     | raster  | `/rasters/hydric-anomaly-10m.png` (ΔNDMI, GEE)             |
| `disturbance`| raster  | `/rasters/disturbance-severity-10m.png` (dNBR, GEE)        |
| `erosion`    | raster  | `/rasters/a-rusle-actual.png` (built GeoTIFF)              |
| `lidar`      | raster+overlay | `/rasters/pnoa-chm-2m.png` **+** `/geojson/lidar-canopy-metrics.geojson` |

The default tab is `hydric`; the camera seeds from its footprint.

**Composite layers.** A raster layer may declare an `overlay` — a GeoJSON
wired above the image as its own source plus zero-opacity fill/line layers.
The overlay is **invisible by design** (the raster is the visual; hit-testing
works on geometry, not painted pixels). The LiDAR tab uses it so the CHM is
the only thing drawn, while clicks still resolve to stands and open the
inspector, feature table and pointer cursor. Consumers ask
`vectorViewOf(layer)` for the per-feature view instead of branching on
`kind`.

`MapLayerToggle` is a Radix `ToggleGroup` with `type="single"`. This is the
canonical Radix primitive for a 2–7 mutually exclusive set per the shadcn
skill. Click a tile → active layer changes → `map-canvas.tsx` swaps the source
and re-adds the right layer(s) (the previous layers are removed first to keep
MapLibre's caches happy).

Every tab also **frames its own data**: vector layers via `geojsonBounds()` on
the fetched features, the raster via its generated `bounds`, both through
`map.fitBounds(..., fitBoundsOptions)`.

## The baked rasters

MapLibre cannot read a GeoTIFF and there is no tile service behind these
datasets, so `scripts/build-*.mjs` bake each one once at build time
(`predev` / `prebuild`, also `npm run rasters:build`):

| script                       | source                        | output                         |
| ---------------------------- | ----------------------------- | ------------------------------ |
| `build-rusle-raster.mjs`     | `A_rusle_actual.tif`          | `a-rusle-actual.png`           |
| `build-hydric-raster.mjs`    | hydric anomaly GeoTIFF        | `hydric-anomaly-10m.png`       |
| `build-disturbance-raster.mjs` | disturbance severity GeoTIFF  | `disturbance-severity-10m.png` |
| `build-lidar-raster.mjs`     | `pnoa-chm-2m.tif` (2 m CHM)   | `pnoa-chm-2m.png`              |

All four share `scripts/lib/geotiff.mjs` (classic TIFF parsing) and
`scripts/lib/bake.mjs` (PNG encoding, ramps, ticks, UTM inverse) and emit a
typed `src/data/*-raster.generated.ts` with bounds, ramp, ticks and stats.
The RUSLE bake, in short:

1. Parse the classic TIFF directory (little-endian, float32, LZW, 11 strips).
2. Decode each strip. `RowsPerStrip` does not have to divide `ImageLength` —
   the last strip here is a single row — so each strip is asked for exactly
   the rows it actually holds.
3. Recover the WGS84 footprint by inverse-projecting the tiepoint with the
   UTM inverse transverse Mercator. The GeoKeys carry no EPSG, so the zone is
   the single documented assumption in the script; the CHM source **does**
   declare EPSG:25830, so that script parses the zone from the file instead.
4. Map values onto a palette and write an RGBA PNG (nodata → alpha 0) plus
   the generated manifest.

Two decisions worth keeping:

- **The display ramp is logarithmic.** RUSLE is a product of factors
  (R·K·LS·C·P), so the distribution is log-normal (here: p50 56, p98 722). On a
  linear ramp ~75% of cells collapse into the first two colour stops.
- **Only true nodata becomes transparent.** A "low values are empty" cutoff
  looks reasonable and silently hides a quarter of the grid.

The LiDAR CHM bake differs deliberately: canopy height is linear, trimmed to
the 2nd–98th percentile snapped to a 5 m step (so the legend lands on round
metres), while ground cells at 0 m are real data and stay painted.

`raster-opacity` is driven by the shadcn `Slider` in `map-legend.tsx`, applied
with `setPaintProperty` so dragging it does not re-add the layer.

## Click → feature panel

`map-canvas.tsx` queries rendered features at the click point, filtered to the
layers whose `source` is the active one. (Querying `SOURCE_ID` directly — as an
earlier version did — matches nothing, because that is the *source* id and never
a layer id, so clicks silently did nothing.) On hit it calls back to the
`MapSandbox` orchestrator with the feature and a `{lng, lat}`, which surfaces
the `properties` keys declared in `map-layers.ts`.

Raster layers without an overlay have no per-feature attributes, so they
render no feature panel; their summary rows stand in for the table. A
raster **with** an overlay (LiDAR) behaves like a vector layer: clicks are
hit-tested against the overlay's layers and open the same panel.

The empty state (no feature selected) hides the panel via `hidden`.

## Fallbacks (no WebGL / no JS / no tiles)

Three layers of graceful degradation:

1. **`detectWebGL()`** runs once on mount. If false, `MapSandbox` renders a
   text notice in the canvas area and skips MapLibre entirely.
2. **`<noscript>`** inside the canvas frame keeps the page usable when JS
   is off — the screenshot only shows a notice, but the feature tables
   below still load.
3. **`<FeatureTable activeLayerId={...}>`** is always rendered beneath
   the map; it fetches every layer's GeoJSON and renders plain HTML
   tables. Screen readers, browsers without WebGL, and print-mode all
   reach this.

## Swapping mock GeoJSON for real data

The single file in `public/geojson/` (`lidar-canopy-metrics.geojson`) is
**mock data** — it exists so `npm run dev` renders something interesting, but
it is not a real campaign output. See [assets.md](./assets.md) for the
placeholder rules.

To swap a layer:

1. Drop the real `.geojson` file at the same path (or update the
   `geojson` field in `src/data/map-layers.ts`).
2. Make sure each feature has the `properties` keys declared in the layer
   definition (`map-layers.ts`), or extend the layer definition to add
   more columns.
3. Bump the `attribution` field if the source requires credit.

Coordinate reference system: MapLibre's default style `version: 8` expects
`EPSG:4326` (lon, lat). If your source is `EPSG:3857`, add a
`promoteId` / `attribution` / set the source with a
`coordinates: [lng, lat]` bbox and MapLibre will project for you — but for
vector data the GeoJSON spec requires `Feature.geometry.coordinates` to be
in WGS-84.
