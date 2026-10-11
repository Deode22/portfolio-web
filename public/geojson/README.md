# `public/geojson/` — mock dataset

**TODO — this file is mock data** so the map sandbox renders on first run.
It is tracked in git and should be replaced with real stand / campaign
GeoJSON before publishing the site.

| File                            | What it stands in for                                   |
| ------------------------------- | ------------------------------------------------------- |
| `lidar-canopy-metrics.geojson`  | PNOA LiDAR stand polygons with structural metrics (mock) |

The 9 stands carry the real attribute schema (`stand_id`,
`dominant_species` — Pinus halepensis, `p95_height` and `mean_height` relative to
the ground, `canopy_cover_fcc`, `estimated_timber_volume`, `point_density`) in
a ~1 km² demo footprint, for demo purposes only. Verify before publication.

## The RUSLE tab is not mocked

The "Erosion (RUSLE)" tab used to point at a mock `erosion-sample.geojson`.
It now renders the **real** raster from `public/rasters/`:

- source: `public/rasters/A_rusle_actual.tif` (201 × 101, float32, LZW, 10 m,
  UTM zone 30N)
- derived: `public/rasters/a-rusle-actual.png` — a colormapped RGBA PNG, baked
  by `scripts/build-rusle-raster.mjs` and regenerated on `predev` / `prebuild`
- bounds, ramp, tick positions and statistics land in
  `src/data/rusle-raster.generated.ts`

A GeoTIFF cannot be read by MapLibre and there is no tile service behind it,
so the raster is converted once at build time rather than in the browser.

To regenerate:
```bash
npm run assets:sync
npm run rasters:build
```