/**
 * GeoTIFF -> colormapped RGBA PNG + generated manifest.
 *
 * MapLibre cannot read a GeoTIFF, and there is no tile service behind this
 * dataset, so the raster is baked once at build time into something the
 * `image` source understands: a PNG plus the WGS84 footprint it covers.
 * Baking keeps the browser cost at one small decode instead of an LZW +
 * float32 pipeline on every page load.
 *
 * Source: public/rasters/A_rusle_actual.tif (single band, float32, LZW).
 * Output: public/rasters/a-rusle-actual.png (colormapped, nodata -> alpha 0)
 *         src/data/rusle-raster.generated.ts (bounds, ramp, stats)
 *
 * TIFF parsing, PNG encoding and the projection maths live in scripts/lib/
 * and are shared with the hydric and disturbance bakes. This script keeps
 * only what is RUSLE-specific: the ramp, the log scale and the output text.
 *
 * The .tif is stored in UTM but ships without an EPSG code in its GeoKeys
 * (GeoAsciiParams is "unknown|unknown|"), so CRS_UTM_ZONE below is the
 * only place that assumption lives. Verify it against the tiepoint before
 * trusting the footprint.
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
  roundTicks,
  utmProjector,
} from "./lib/bake.mjs";

const projectRoot = process.cwd();
const SOURCE_TIF = join(projectRoot, "public", "rasters", "A_rusle_actual.tif");
const OUT_PNG = join(projectRoot, "public", "rasters", "a-rusle-actual.png");
const OUT_TS = join(projectRoot, "src", "data", "rusle-raster.generated.ts");

/**
 * The tiepoint (753780, 4465470) with 10 m pixels sits near 0 deg E, which
 * is the UTM 30/31 zone boundary. 30 keeps the raster inside its own zone.
 */
const CRS_UTM_ZONE = 30;
const CRS_EPSG = 32600 + CRS_UTM_ZONE;
const CRS_LABEL = `EPSG:${CRS_EPSG} (WGS 84 / UTM zone ${CRS_UTM_ZONE}N)`;

/**
 * Sequential ramp for soil loss. Stops are lifted from the project palette
 * so the overlay belongs to the same page as the rest of the chrome:
 * sage -> bone -> ochre -> oxide -> deep oxide red, monotonically warmer
 * and darker as erosion gets worse. Mid-tones throughout, because the
 * layer composites over both the dark UI and bright satellite pixels.
 */
const RAMP = [
  { at: 0, hex: "#9DA68A" },
  { at: 0.25, hex: "#C6C0B0" },
  { at: 0.5, hex: "#C08050" },
  { at: 0.75, hex: "#8C5A3A" },
  { at: 1, hex: "#7A2B22" },
];

/**
 * Soil loss is a product of factors (R*K*LS*C*P), so its distribution is
 * log-normal and a linear ramp buries ~75% of the cells in the first two
 * stops. The display ramp is therefore logarithmic, which is both the
 * readable and the physically honest choice.
 */
const SCALE_MODE = "log";

const sampleRamp = makeSampler(RAMP);

/* ------------------------------------------------------------------ main --- */

function main() {
  let tif;
  try {
    tif = readTiff(readFileSync(SOURCE_TIF));
  } catch (err) {
    if (err.code === "ENOENT") {
      console.warn(
        `[build-rusle-raster] ${relative(projectRoot, SOURCE_TIF)} not found — ` +
          `keeping the existing manifest. The RUSLE tab degrades to a placeholder.`
      );
      return;
    }
    throw err;
  }

  const { width, height, pixels, nodata } = tif;

  // Percentile trim keeps a handful of extreme cells from flattening the
  // whole ramp; 2/98 is the usual choice for soil-loss grids.
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
  // Log scaling needs a strictly positive floor. A grid containing zero or
  // negatives cannot use it, so it degrades to linear rather than throwing.
  const scaleMode = SCALE_MODE === "log" && lo > 0 ? "log" : "linear";
  const span = hi - lo;
  const logLo = Math.log(lo);
  const logSpan = Math.log(hi) - logLo;

  /** Value -> 0..1 position on the display ramp. */
  const normalise = (v) =>
    scaleMode === "log"
      ? Math.min(1, Math.max(0, (Math.log(v) - logLo) / logSpan))
      : Math.min(1, Math.max(0, (v - lo) / span));

  // Round-number ticks inside the displayed range, see roundTicks(): 1/2/5
  // mantissas first, plain decades when that reads better.
  const ticks = roundTicks(lo, hi).map((value) => ({ value, at: normalise(value) }));

  // Decode sanity check, opt-in. Soil-loss grids are spatially smooth, so a
  // correct LZW pass gives neighbours that differ far less than the overall
  // range; a mis-decoded one gives salt-and-pepper noise. Reported rather than
  // asserted, because the failure mode is a plausible-looking ramp.
  if (process.env.RUSLE_DEBUG === "1") {
    let noData = 0;
    let negative = 0;
    let nonFinite = 0;
    let neighbourDelta = 0;
    let neighbourPairs = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = pixels[y * width + x];
        if (nodata !== null && Number.isFinite(v) && Math.abs(v - nodata) <= 1e-6) noData++;
        else if (!Number.isFinite(v)) nonFinite++;
        else if (v < 0) negative++;
        if (x > 0) {
          const p = pixels[y * width + x - 1];
          if (isValidCell(v, nodata) && isValidCell(p, nodata)) {
            neighbourDelta += Math.abs(v - p);
            neighbourPairs++;
          }
        }
      }
    }
    const ladder = [0, 5, 10, 25, 40, 50, 60, 75, 90, 95, 98, 99, 100]
      .map((p) => `p${p} ${fmt(p === 100 ? valid[valid.length - 1] : q(p / 100), 2)}`)
      .join("  ");
    console.info(
      `[build-rusle-raster] debug\n` +
        `  cells ${width * height}, nodata ${noData}, negative ${negative}, non-finite ${nonFinite}\n` +
        `  ${ladder}\n` +
        `  mean |neighbour delta| ${fmt(neighbourDelta / Math.max(1, neighbourPairs), 3)} ` +
        `vs range ${fmt(span, 3)} (ratio ${fmt(neighbourDelta / Math.max(1, neighbourPairs) / span, 4)})`
    );
  }

  const rgba = Buffer.alloc(width * height * 4);
  let painted = 0;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    // Only true nodata becomes transparent. A linear "low values are empty"
    // cutoff was hiding 24% of this grid, which are real low-erosion cells.
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
  const bounds = footprintBounds(tif.geotransform, width, height, utmProjector(CRS_UTM_ZONE));
  const center = centerOf(bounds);

  const body = `/**
 * GENERATED by scripts/build-rusle-raster.mjs — do not edit.
 *
 * Source raster: ${relative(projectRoot, SOURCE_TIF).replace(/\\/g, "/")}
 * Source CRS:    ${CRS_LABEL}
 * Colours baked into: ${relative(projectRoot, OUT_PNG).replace(/\\/g, "/")}
 *
 * Everything the map and the legend need is resolved here, so the client
 * never has to know the raster is 10 m/px float32 in UTM.
 */

/** Footprint in WGS84 as [west, south, east, north]. */
export const rusleBounds = [${bounds.map((n) => fmt(n, 6)).join(", ")}] as const;

/** Where the camera should sit when the RUSLE tab opens. */
export const rusleCenter = [${center.map((n) => fmt(n, 6)).join(", ")}] as const;

/** Raster grid, before any client-side styling. */
export const rusleGrid = {
  width: ${width},
  height: ${height},
  pixelSizeMetres: ${fmt(Math.abs(tif.geotransform.pixelW))},
  crs: ${JSON.stringify(CRS_LABEL)},
  epsg: ${CRS_EPSG},
} as const;

/**
 * Displayed range: valid cells trimmed to the 2nd-98th percentile, mapped
 * through a ${scaleMode} scale. Cells outside the range clamp to the ramp ends;
 * trueMin/trueMax keep the untrimmed extremes visible.
 */
export const rusleRange = {
  min: ${fmt(lo)},
  max: ${fmt(hi)},
  median: ${fmt(q(0.5))},
  mean: ${fmt(valid.reduce((a, b) => a + b, 0) / valid.length)},
  trueMin: ${fmt(valid[0], 3)},
  trueMax: ${fmt(valid[valid.length - 1], 3)},
  scale: ${JSON.stringify(scaleMode)},
  nodata: ${nodata === null ? "null" : fmt(nodata, 1)},
  validCells: ${valid.length},
  paintedCells: ${painted},
  unit: "t/ha/yr",
  label: "Soil loss (RUSLE A)",
} as const;

/** Sequential ramp stops; the legend gradient is built from these. */
export const rusleRamp = [
${RAMP.map((s) => `  { at: ${s.at}, hex: ${JSON.stringify(s.hex)} },`).join("\n")}
] as const;

/**
 * Legend tick positions, already mapped through the ${scaleMode} scale so the
 * gradient labels sit where those values actually are in the baked PNG.
 * Round 1/2/5-decade values are preferred; "nice" numbers read as a scale.
 */
export const rusleTicks = [
${ticks.map((t) => `  { value: ${t.value}, at: ${fmt(t.at, 4)} },`).join("\n")}
] as const;

/** Default overlay opacity, 0-1. Tuned to sit over the satellite basemap. */
export const rusleDefaultOpacity = 0.6;

export const ruslePngPath = "/rasters/a-rusle-actual.png";
`;

  mkdirSync(dirname(OUT_TS), { recursive: true });
  writeFileSync(OUT_TS, body.replace(/\r\n/g, "\n"), "utf8");

  console.info(
    `[build-rusle-raster] ${width}x${height} -> ${relative(projectRoot, OUT_PNG)} ` +
      `(${png.length} B, ${painted} painted cells)\n` +
      `  bounds ${bounds.map((n) => fmt(n, 4)).join(", ")}\n` +
      `  range ${fmt(lo)} .. ${fmt(hi)} ${"t/ha/yr"}`
  );
}

main();
