/**
 * PNOA CHM GeoTIFF -> colormapped RGBA PNG + generated manifest.
 *
 * Same bake pattern as build-rusle-raster.mjs: MapLibre cannot read a
 * GeoTIFF and there is no tile service behind this dataset, so the canopy
 * height model is baked once at build time into a PNG plus the WGS84
 * footprint it covers. The client pays one small decode instead of a
 * float32 pipeline on every page load.
 *
 * Source: public/rasters/pnoa-chm-2m.tif (single band, float32, 2 m grid).
 * Output: public/rasters/pnoa-chm-2m.png (colormapped, nodata -> alpha 0)
 *         src/data/lidar-raster.generated.ts (bounds, ramp, stats)
 *
 * Unlike the RUSLE source, this GeoTIFF carries its CRS in the GeoKeys
 * (EPSG:25830, ETRS89 / UTM zone 30N), so the zone is parsed from the file
 * instead of being assumed -- the transverse-mercator maths is identical to
 * WGS84 UTM and the residual datum shift is well under a metre, which is
 * irrelevant for a bounding box.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { isValidCell, readTiff } from "./lib/geotiff.mjs";
import {
  centerOf,
  encodePng,
  fmt,
  footprintBounds,
  makeSampler,
  percentile,
  stepTicks,
  utmProjector,
} from "./lib/bake.mjs";

const projectRoot = process.cwd();
const SOURCE_TIF = join(projectRoot, "public", "rasters", "pnoa-chm-2m.tif");
const OUT_PNG = join(projectRoot, "public", "rasters", "pnoa-chm-2m.png");
const OUT_TS = join(projectRoot, "src", "data", "lidar-raster.generated.ts");

/**
 * Progressive canopy height ramp, understory -> dominant canopy. YlGn-style
 * stops so the overlay belongs to the same page as the rest of the chrome:
 * pale yellow-green ground, saturated deep green at the tallest crowns.
 */
const RAMP = [
  { at: 0, hex: "#ffffcc" },
  { at: 0.25, hex: "#c2e699" },
  { at: 0.5, hex: "#78c679" },
  { at: 0.75, hex: "#31a354" },
  { at: 1, hex: "#006837" },
];

/**
 * Display domain: 2nd-98th percentile of valid cells, snapped to a 5 m
 * step. A raw 0..max domain buries the median canopy (~7 m) in the first
 * 15% of the ramp because CHM grids carry a long thin tail of a few tall
 * crowns and sensor artefacts; the snap also keeps the legend ticks on
 * round metres. Cells outside the domain clamp to the ramp ends and
 * trueMin/trueMax keep the untrimmed extremes visible in the manifest.
 */
const DOMAIN_SNAP_M = 5;
const TICK_STEP_M = 5;

/** Default overlay opacity, 0-1. Dense enough to read the ramp, loose enough to keep the imagery. */
const DEFAULT_OPACITY = 0.6;

const sampleRamp = makeSampler(RAMP);

/** UTM zone for a known UTM-coded EPSG (258xx ETRS89, 326xx/327xx WGS84). */
function utmZoneOf(epsg) {
  if (epsg >= 25801 && epsg <= 25899) return { zone: epsg - 25800, south: false };
  if (epsg >= 32601 && epsg <= 32660) return { zone: epsg - 32600, south: false };
  if (epsg >= 32701 && epsg <= 32760) return { zone: epsg - 32700, south: true };
  return null;
}

/* ------------------------------------------------------------------ main --- */

function main() {
  let tif;
  try {
    tif = readTiff(readFileSync(SOURCE_TIF));
  } catch (err) {
    if (err.code === "ENOENT") {
      console.warn(
        `[build-lidar-raster] ${relative(projectRoot, SOURCE_TIF)} not found — ` +
          `keeping the existing manifest. The CHM tab degrades to a placeholder.`
      );
      return;
    }
    throw err;
  }

  const epsg = tif.crs?.epsg ?? null;
  const utm = epsg === null ? null : utmZoneOf(epsg);
  if (utm === null) {
    throw new Error(
      `expected a UTM GeoTIFF with a UTM-coded CRS in its GeoKeys, got ${JSON.stringify(tif.crs)}`
    );
  }
  if (utm.south) {
    throw new Error(`EPSG:${epsg} is a southern-hemisphere zone; utmProjector() assumes north`);
  }
  const CRS_LABEL = tif.crs.label ?? `EPSG:${epsg}`;

  const { width, height, pixels, nodata } = tif;

  // Valid cells only: nodata (-9999) is punched through as transparency.
  // Zero height is a real ground cell, not nodata.
  const valid = [];
  for (const v of pixels) {
    if (isValidCell(v, nodata)) valid.push(v);
  }
  if (valid.length === 0) throw new Error("every cell is nodata");

  valid.sort((a, b) => a - b);
  const q = (p) => percentile(valid, p);
  let lo = q(0.02);
  let hi = q(0.98);
  if (hi <= lo) {
    lo = valid[0];
    hi = valid[valid.length - 1] || lo + 1;
  }
  // Snap the domain outward to the tick step so the legend lands on round
  // metres (floor keeps ground at 0; the ceiling never truncates data).
  lo = Math.floor(lo / DOMAIN_SNAP_M) * DOMAIN_SNAP_M;
  hi = Math.ceil(hi / DOMAIN_SNAP_M) * DOMAIN_SNAP_M;

  const span = hi - lo;
  const normalise = (v) => Math.min(1, Math.max(0, (v - lo) / span));

  const ticks = stepTicks(lo, hi, TICK_STEP_M).map((value) => ({
    value,
    at: normalise(value),
  }));

  const rgba = Buffer.alloc(width * height * 4);
  let painted = 0;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (!isValidCell(v, nodata)) {
      rgba[i * 4 + 3] = 0;
      continue;
    }
    const [r, g, b] = sampleRamp(normalise(v));
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
    painted++;
  }

  const png = encodePng(width, height, rgba);
  mkdirSync(dirname(OUT_PNG), { recursive: true });
  writeFileSync(OUT_PNG, png);

  // Four corners, then order into the [west, south, east, north] bbox that
  // both MapLibre and the legend consume.
  const bounds = footprintBounds(tif.geotransform, width, height, utmProjector(utm.zone));
  const center = centerOf(bounds);

  const body = `/**
 * GENERATED by scripts/build-lidar-raster.mjs — do not edit.
 *
 * Source raster: ${relative(projectRoot, SOURCE_TIF).replace(/\\/g, "/")}
 * Source CRS:    ${CRS_LABEL}
 * Colours baked into: ${relative(projectRoot, OUT_PNG).replace(/\\/g, "/")}
 *
 * Everything the map and the legend need is resolved here, so the client
 * never has to know the raster is 2 m/px float32 in UTM.
 */

/** Footprint in WGS84 as [west, south, east, north]. */
export const lidarBounds = [${bounds.map((n) => fmt(n, 6)).join(", ")}] as const;

/** Where the camera should sit when the CHM tab opens. */
export const lidarCenter = [${center.map((n) => fmt(n, 6)).join(", ")}] as const;

/** Raster grid, before any client-side styling. */
export const lidarGrid = {
  width: ${width},
  height: ${height},
  pixelSizeMetres: ${fmt(Math.abs(tif.geotransform.pixelW))},
  crs: ${JSON.stringify(CRS_LABEL)},
  epsg: ${epsg},
} as const;

/**
 * Displayed range: valid cells trimmed to the 2nd-98th percentile and
 * snapped to a ${DOMAIN_SNAP_M} m step, mapped through a linear scale. Cells outside
 * the range clamp to the ramp ends; trueMin/trueMax keep the untrimmed
 * extremes visible.
 */
export const lidarRange = {
  min: ${fmt(lo)},
  max: ${fmt(hi)},
  median: ${fmt(q(0.5))},
  mean: ${fmt(valid.reduce((a, b) => a + b, 0) / valid.length)},
  trueMin: ${fmt(valid[0], 3)},
  trueMax: ${fmt(valid[valid.length - 1], 3)},
  scale: "linear",
  nodata: ${nodata === null ? "null" : fmt(nodata, 1)},
  validCells: ${valid.length},
  paintedCells: ${painted},
  unit: "m",
  label: "Canopy height (CHM)",
} as const;

/** Sequential ramp stops; the legend gradient is built from these. */
export const lidarRamp = [
${RAMP.map((s) => `  { at: ${s.at}, hex: ${JSON.stringify(s.hex)} },`).join("\n")}
] as const;

/**
 * Legend tick positions, already mapped through the linear scale so the
 * gradient labels sit where those values actually are in the baked PNG.
 * Fixed ${TICK_STEP_M} m ladder: canopy height reads better on even metres than on
 * 1/2/5 mantissas inside a 0-${fmt(hi, 0)} m domain.
 */
export const lidarTicks = [
${ticks.map((t) => `  { value: ${t.value}, at: ${fmt(t.at, 4)} },`).join("\n")}
] as const;

/** Default overlay opacity, 0-1. Tuned to sit over the satellite basemap. */
export const lidarDefaultOpacity = ${DEFAULT_OPACITY};

export const lidarPngPath = "/rasters/pnoa-chm-2m.png";
`;

  mkdirSync(dirname(OUT_TS), { recursive: true });
  writeFileSync(OUT_TS, body.replace(/\r\n/g, "\n"), "utf8");

  console.info(
    `[build-lidar-raster] ${width}x${height} -> ${relative(projectRoot, OUT_PNG)} ` +
      `(${png.length} B, ${painted} painted cells)\n` +
      `  bounds ${bounds.map((n) => fmt(n, 4)).join(", ")}\n` +
      `  range ${fmt(lo)} .. ${fmt(hi)} m (true ${fmt(valid[0])} .. ${fmt(valid[valid.length - 1])})`
  );
}

main();
