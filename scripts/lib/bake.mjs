/**
 * Shared bake pipeline: PNG encoding, ramp sampling, statistics, round-number
 * ticks and the coordinate maths that turns a raster's georeferencing into a
 * WGS84 footprint.
 *
 * Extracted from scripts/build-rusle-raster.mjs so the hydric and disturbance
 * bakes cannot drift away from it. Every function here is used by all three
 * scripts, so keep the arithmetic order stable — the RUSLE output is verified
 * byte-for-byte against its pre-refactor PNG and generated module.
 */
import { deflateSync } from "node:zlib";

/* ------------------------------------------------------------------ PNG --- */

export function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

export function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Truecolour + alpha PNG, one "None" filter byte per scanline. */
export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // One filter byte (0 = None) per scanline keeps the encoder trivial;
  // deflate does the real work on these small grids.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------- colour --- */

export function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** Build a 0..1 -> [r,g,b] sampler from ramp stops ordered by `at`. */
export function makeSampler(ramp) {
  const stops = ramp.map((s) => ({ at: s.at, rgb: hexToRgb(s.hex) }));
  return (t) => {
    const x = Math.min(1, Math.max(0, t));
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      if (x <= b.at) {
        const f = b.at === a.at ? 0 : (x - a.at) / (b.at - a.at);
        return [
          Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f),
          Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f),
          Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f),
        ];
      }
    }
    return stops[stops.length - 1].rgb;
  };
}

/* ------------------------------------------------------------- stats ------ */

/** Nearest-rank quantile over an ascending-sorted array. */
export function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

/** Ascending-sorted copy of every cell the predicate accepts. */
export function sortedValid(pixels, accept) {
  const out = [];
  for (const v of pixels) if (accept(v)) out.push(v);
  out.sort((a, b) => a - b);
  return out;
}

/**
 * Round-number ticks inside (lo, hi). 1/2/5 mantissas first; if that yields
 * more than a readable handful, fall back to plain decades. Returned as raw
 * values — the caller maps them through its display scale.
 */
export function roundTicks(lo, hi) {
  const niceTicks = [];
  for (let k = -6; k <= 9; k++) {
    for (const m of [1, 2, 5]) {
      const value = m * 10 ** k;
      if (value > lo && value < hi) niceTicks.push(value);
    }
  }
  const decadeTicks = niceTicks.filter((v) => Math.abs(v / 10 ** Math.round(Math.log10(v)) - 1) < 1e-9);
  return (decadeTicks.length >= 3 && decadeTicks.length <= 6 ? decadeTicks : niceTicks).slice(0, 6);
}

/**
 * Ticks on a fixed step (used by the divergent hydric ramp, where a plain
 * 0.05 ladder reads better than 1/2/5 mantissas). Endpoints are excluded:
 * the legend prints them in its own min/max row.
 */
export function stepTicks(lo, hi, step) {
  const out = [];
  const first = Math.ceil(lo / step + 1e-9) * step;
  for (let v = first; v < hi - step * 1e-9; v += step) {
    if (v > lo && v < hi) out.push(Number(v.toFixed(6)));
  }
  return out;
}

/* ---------------------------------------------------------- projection ----- */

/** WGS84 ellipsoid. */
const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const RAD2DEG = 180 / Math.PI;

/** Inverse Transverse Mercator (Karney/standard series), UTM north. */
export function utmToLngLat(easting, northing, zone) {
  const k0 = 0.9996;
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const x = easting - 500000;
  const y = northing;

  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const M = y / k0;
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const C1 = e1 * e1 * cosPhi1 * cosPhi1;
  const T1 = tanPhi1 * tanPhi1;
  const N1 = A / Math.sqrt(1 - E2 * sinPhi1 * sinPhi1);
  const R1 = (A * (1 - E2)) / Math.pow(1 - E2 * sinPhi1 * sinPhi1, 1.5);
  const D = x / (N1 * k0);

  const lat =
    (phi1 -
      ((N1 * tanPhi1) / R1) *
        ((D * D) / 2 -
          ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * E2) * D ** 4) / 24 +
          ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * E2 - 3 * C1 * C1) * D ** 6) / 720)) *
    RAD2DEG;

  const lng =
    lon0 +
    ((D - ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * E2 + 24 * T1 * T1) * D ** 5) / 120) /
      cosPhi1) *
      RAD2DEG;

  return [lng, lat];
}

/**
 * [west, south, east, north] in WGS84 from an affine georeferencing.
 * `project` maps model coordinates to lng/lat: the identity for geographic
 * rasters, `utmToLngLat` for projected ones.
 */
export function footprintBounds(geotransform, width, height, project) {
  const g = geotransform;
  const at = (col, row) => project(g.originX + col * g.pixelW + row * g.rotX, g.originY + col * g.rotY + row * g.pixelH);
  const corners = [at(0, 0), at(width, 0), at(0, height), at(width, height)];
  const lngs = corners.map((c) => c[0]);
  const lats = corners.map((c) => c[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/** Identity projection for geographic (EPSG:4326) georeferencing. */
export const asLngLat = (x, y) => [x, y];

/** UTM-north projection factory, for grids stored in metres. */
export const utmProjector = (zone) => (easting, northing) => utmToLngLat(easting, northing, zone);

export const centerOf = (bounds) => [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];

export const fmt = (n, d = 2) => n.toFixed(d);
