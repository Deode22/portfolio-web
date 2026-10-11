/**
 * Minimal, dependency-free GeoTIFF reader for the raster bake scripts.
 *
 * The RUSLE source is a classic little-endian, strip-laid, LZW-compressed
 * float32 grid. The two Google Earth Engine exports are not: one is
 * BigTIFF + tiled LZW float32, the other big-endian classic + tiled Adobe
 * Deflate uint8 with a ModelTransformation matrix instead of a tiepoint.
 * All three have to land in the same RGBA bake pipeline, so the format
 * handling lives here and the scripts only see samples + georeferencing.
 *
 * Deliberately out of scope: JPEG compression, predictor 3 (floating point
 * differencing), planar configurations and multi-band images. Each throws a
 * descriptive error rather than emitting a plausible-looking wrong raster.
 */
import { inflateSync, inflateRawSync } from "node:zlib";

/* ------------------------------------------------------------------ tags --- */

const TAG = {
  ImageWidth: 256,
  ImageLength: 257,
  BitsPerSample: 258,
  Compression: 259,
  StripOffsets: 273,
  SamplesPerPixel: 277,
  RowsPerStrip: 278,
  StripByteCounts: 279,
  PlanarConfiguration: 284,
  Predictor: 317,
  TileWidth: 322,
  TileLength: 323,
  TileOffsets: 324,
  TileByteCounts: 325,
  SampleFormat: 339,
  ModelPixelScale: 33550,
  ModelTiepoint: 33922,
  ModelTransformation: 34264,
  GeoKeyDirectory: 34735,
  GDAL_NODATA: 42113,
};

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8, 17: 8, 18: 8 };

/* ------------------------------------------------------------- IFD parse --- */

function parseTiff(buf) {
  const bom = buf.toString("ascii", 0, 2);
  if (bom !== "II" && bom !== "MM") throw new Error(`not a TIFF (BOM ${JSON.stringify(bom)})`);
  const le = bom === "II";
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const u64 = (o) => Number(le ? buf.readBigUInt64LE(o) : buf.readBigUInt64BE(o));
  const f64 = (o) => (le ? buf.readDoubleLE(o) : buf.readDoubleBE(o));
  const f32 = (o) => (le ? buf.readFloatLE(o) : buf.readFloatBE(o));

  const magic = u16(2);
  const big = magic === 43;
  if (!big && magic !== 42) throw new Error(`not a TIFF (magic ${magic})`);
  let ifd = big ? u64(8) : u32(4);
  const tags = new Map();

  const readVals = (type, n, base) => {
    const sz = TYPE_SIZE[type] ?? 1;
    if (type === 2) {
      // ASCII: raw bytes, NUL-terminated.
      return buf.subarray(base, base + n).toString("ascii").replace(/\0+$/, "");
    }
    const out = new Array(n);
    for (let k = 0; k < n; k++) {
      const o = base + k * sz;
      if (type === 3) out[k] = u16(o);
      else if (type === 4) out[k] = u32(o);
      else if (type === 16 || type === 17 || type === 18) out[k] = u64(o);
      else if (type === 12) out[k] = f64(o);
      else if (type === 11) out[k] = f32(o);
      else if (type === 5 || type === 10) {
        // RATIONAL / SRATIONAL: a numerator/denominator pair of LONGs.
        const num = type === 5 ? u32(o) : u32(o) | 0;
        const den = type === 5 ? u32(o + 4) : u32(o + 4) | 0;
        out[k] = den === 0 ? 0 : num / den;
      } else if (type === 1 || type === 7) out[k] = buf[o];
      else throw new Error(`TIFF type ${type} not supported`);
    }
    return out;
  };

  // Walk the IFD chain: every tag this repo needs lives in the first
  // directory, but hopping to a second one costs nothing.
  let hops = 0;
  while (ifd !== 0 && hops < 4) {
    const entrySize = big ? 20 : 12;
    const count = big ? u64(ifd) : u16(ifd);
    for (let i = 0; i < count; i++) {
      const e = ifd + (big ? 8 : 2) + i * entrySize;
      const tag = u16(e);
      const type = u16(e + 2);
      const n = big ? u64(e + 4) : u32(e + 4);
      const size = (TYPE_SIZE[type] ?? 1) * n;
      const inlineLimit = big ? 8 : 4;
      const base = size > inlineLimit ? (big ? u64(e + 12) : u32(e + 8)) : e + (big ? 12 : 8);
      tags.set(tag, readVals(type, n, base));
    }
    ifd = big ? u64(ifd + 8 + count * entrySize) : u32(ifd + 2 + count * 12);
    hops++;
  }

  return { buf, le, big, tags };
}

/* ------------------------------------------------------------------ LZW --- */

/**
 * TIFF's LZW dialect: MSB-first codes, early change, and the dictionary is
 * reset one code *before* the encoder's table index catches up.
 */
function lzwDecode(input, expectedBytes) {
  const out = Buffer.alloc(expectedBytes);
  let outPos = 0;

  const dict = [];
  const resetDict = () => {
    dict.length = 0;
    for (let i = 0; i < 256; i++) dict[i] = [i];
    dict.length = 258;
  };
  resetDict();

  let codeWidth = 9;
  let prev = null;
  let bitBuf = 0;
  let bitCount = 0;
  let pos = 0;

  const nextCode = () => {
    while (bitCount < codeWidth) {
      if (pos >= input.length) return -1;
      bitBuf = (bitBuf << 8) | input[pos++];
      bitCount += 8;
    }
    bitCount -= codeWidth;
    const code = (bitBuf >>> bitCount) & ((1 << codeWidth) - 1);
    // Keep only the unconsumed bits. Without this the accumulator keeps its
    // whole history, `<< 8` eventually shifts live bits out, and the stream
    // appears to end early.
    bitBuf &= bitCount === 0 ? 0 : (1 << bitCount) - 1;
    return code;
  };

  for (;;) {
    const code = nextCode();
    if (code === -1) break;

    if (code === 256) {
      resetDict();
      codeWidth = 9;
      prev = null;
      continue;
    }
    if (code === 257) break;

    let entry;
    if (code < dict.length && dict[code]) {
      entry = dict[code];
    } else if (prev) {
      entry = prev.concat(prev[0]);
    } else {
      throw new Error("corrupt LZW stream");
    }

    for (const b of entry) {
      if (outPos >= expectedBytes) return out;
      out[outPos++] = b;
    }

    if (prev) {
      dict.push(prev.concat(entry[0]));
      // Early change: widen one code before the table actually fills.
      if (dict.length + 1 >= 1 << codeWidth && codeWidth < 12) codeWidth++;
    }
    prev = entry;
  }

  if (outPos !== expectedBytes) {
    throw new Error(`LZW produced ${outPos} bytes, expected ${expectedBytes}`);
  }
  return out;
}

function inflateChunk(chunk, expectedBytes, compression) {
  let raw;
  try {
    raw = inflateSync(chunk);
  } catch {
    // Adobe Deflate (32946) is sometimes written raw, without a zlib header.
    raw = inflateRawSync(chunk);
  }
  if (raw.length !== expectedBytes) {
    throw new Error(`deflate (${compression}) produced ${raw.length} bytes, expected ${expectedBytes}`);
  }
  return raw;
}

/* --------------------------------------------------------------- georef --- */

/** ModelPixelScale + ModelTiepoint (tags 33550/33922) -> affine. */
function geotransformFromTiepoint(tif) {
  const scale = tif.tags.get(TAG.ModelPixelScale);
  const tie = tif.tags.get(TAG.ModelTiepoint);
  if (!scale || scale.length < 2 || !tie || tie.length < 6) return null;
  // model = tiepoint + (raster - tiepoint.raster) * scale, with rows growing
  // southwards so the Y scale carries a minus sign in the affine.
  return {
    originX: tie[3] - tie[0] * scale[0],
    pixelW: scale[0],
    rotX: 0,
    originY: tie[4] + tie[1] * scale[1],
    rotY: 0,
    pixelH: -scale[1],
  };
}

/** ModelTransformation (tag 34264): a 4x4 matrix stored row-major. */
function geotransformFromMatrix(tif) {
  const m = tif.tags.get(TAG.ModelTransformation);
  if (!m || m.length < 16) return null;
  // x = m0*col + m1*row + m3, y = m4*col + m5*row + m7
  return {
    originX: m[3],
    pixelW: m[0],
    rotX: m[1],
    originY: m[7],
    rotY: m[4],
    pixelH: m[5],
  };
}

/** GeoKeyDirectory (tag 34735) -> EPSG + coarse CRS kind. */
function parseGeoKeys(tif) {
  const shorts = tif.tags.get(TAG.GeoKeyDirectory);
  if (!shorts || shorts.length < 8) return { kind: null, epsg: null, label: null };
  const keys = new Map();
  for (let i = 4; i + 3 < shorts.length; i += 4) {
    const keyId = shorts[i];
    const location = shorts[i + 1];
    const count = shorts[i + 2];
    const offset = shorts[i + 3];
    // location 0 = the value is inlined in the offset field (our case).
    if (location === 0 && count === 1) keys.set(keyId, offset);
  }
  const model = keys.get(1024); // GTModelTypeGeoKey: 1 projected, 2 geographic
  const geographic = keys.get(2048); // GeographicTypeGeoKey
  const projected = keys.get(3072); // ProjectedCSTypeGeoKey

  if (model === 2 && geographic) {
    return {
      kind: "geographic",
      epsg: geographic,
      label: geographic === 4326 ? "EPSG:4326 (WGS 84)" : `EPSG:${geographic}`,
    };
  }
  if (projected) {
    return { kind: "projected", epsg: projected, label: `EPSG:${projected}` };
  }
  return { kind: null, epsg: null, label: null };
}

/* --------------------------------------------------------------- reader --- */

class GeoTiff {
  constructor(buf) {
    this.tif = parseTiff(buf);
    this.tags = this.tif.tags;
  }

  #first(tag, fallback = null) {
    const v = this.tags.get(tag);
    if (v === undefined) return fallback;
    if (typeof v === "string") return v;
    return v[0];
  }

  get width() {
    return this.#first(TAG.ImageWidth, 0);
  }

  get height() {
    return this.#first(TAG.ImageLength, 0);
  }

  /** Georeferencing: tiepoint and matrix forms resolve to one affine. */
  get geotransform() {
    if (this._geo === undefined) {
      this._geo = geotransformFromTiepoint(this.tif) ?? geotransformFromMatrix(this.tif);
    }
    return this._geo;
  }

  get crs() {
    if (!this._crs) this._crs = parseGeoKeys(this.tif);
    return this._crs;
  }

  /** `GDAL_NODATA` as a number, or null when absent / unparsable. */
  get nodata() {
    if (this._nodataSet) return this._nodata;
    this._nodataSet = true;
    const raw = this.tags.get(TAG.GDAL_NODATA);
    this._nodata = typeof raw === "string" && raw !== "" ? Number(raw) : null;
    if (this._nodata !== null && !Number.isFinite(this._nodata)) this._nodata = null;
    return this._nodata;
  }

  /** Sample values as a Float64Array, row-major, single band. */
  decode() {
    if (this._pixels) return this._pixels;

    const { buf, le } = this.tif;
    const width = this.width;
    const height = this.height;
    const spp = this.#first(TAG.SamplesPerPixel, 1);
    const bpsArr = this.tags.get(TAG.BitsPerSample);
    const bps = Array.isArray(bpsArr) ? bpsArr[0] : bpsArr;
    const sampleFormat = this.#first(TAG.SampleFormat, 1);
    const predictor = this.#first(TAG.Predictor, 1);
    const compression = this.#first(TAG.Compression, 1);
    const planar = this.#first(TAG.PlanarConfiguration, 1);
    const tiled = this.tags.has(TAG.TileWidth);

    if (!width || !height) throw new Error("TIFF is missing image dimensions");
    if (spp !== 1) throw new Error(`expected a single band, got ${spp} samples per pixel`);
    if (planar !== 1) throw new Error(`planar configuration ${planar} is not supported`);
    if (predictor !== 1 && predictor !== 2) throw new Error(`predictor ${predictor} is not supported`);
    if (predictor === 2 && (bps !== 8 && bps !== 16 && bps !== 32)) {
      throw new Error(`predictor 2 with ${bps}-bit samples is not supported`);
    }
    if (sampleFormat === 3 && predictor === 2) {
      throw new Error("predictor 2 (horizontal differencing) on float samples is not supported");
    }
    if (compression !== 1 && compression !== 5 && compression !== 8 && compression !== 32946) {
      throw new Error(`compression ${compression} is not supported`);
    }
    this.meta = { compression, predictor, bps, sampleFormat, tiled };

    const pixelBytes = bps / 8;
    const out = new Float64Array(width * height).fill(NaN);

    const readSample = (data, o) => {
      if (sampleFormat === 3 && bps === 32) return le ? data.readFloatLE(o) : data.readFloatBE(o);
      if (sampleFormat === 3 && bps === 64) return le ? data.readDoubleLE(o) : data.readDoubleBE(o);
      if (bps === 8) return sampleFormat === 2 ? data.readInt8(o) : data[o];
      if (bps === 16) {
        if (sampleFormat === 2) return le ? data.readInt16LE(o) : data.readInt16BE(o);
        return le ? data.readUInt16LE(o) : data.readUInt16BE(o);
      }
      if (bps === 32) {
        if (sampleFormat === 2) return le ? data.readInt32LE(o) : data.readInt32BE(o);
        return le ? data.readUInt32LE(o) : data.readUInt32BE(o);
      }
      throw new Error(`${bps}-bit / sampleFormat ${sampleFormat} samples are not supported`);
    };

    /**
     * Undo TIFF predictor 2: each sample stores the delta from its left
     * neighbour. Accumulation happens in the unsigned bit domain, so the
     * signed reinterpretation only happens when a sample is finally read.
     */
    const undoPredictor2 = (data, samplesPerRow, rows) => {
      const modulus = 2 ** bps;
      const rowBytes = samplesPerRow * pixelBytes;
      const readBits = (o) => {
        if (bps === 8) return data[o];
        if (bps === 16) {
          if (le) return data.readUInt16LE(o);
          return data.readUInt16BE(o);
        }
        if (le) return data.readUInt32LE(o);
        return data.readUInt32BE(o);
      };
      const writeBits = (o, v) => {
        if (bps === 8) {
          data[o] = v;
          return;
        }
        if (bps === 16) {
          if (le) data.writeUInt16LE(v, o);
          else data.writeUInt16BE(v, o);
          return;
        }
        if (le) data.writeUInt32LE(v, o);
        else data.writeUInt32BE(v, o);
      };
      for (let r = 0; r < rows; r++) {
        let prev = 0;
        const base = r * rowBytes;
        for (let i = 0; i < samplesPerRow; i++) {
          const o = base + i * pixelBytes;
          const v = (readBits(o) + prev) % modulus;
          writeBits(o, v);
          prev = v;
        }
      }
    };

    const decompress = (offset, count, expectedBytes) => {
      const chunk = buf.subarray(offset, offset + count);
      if (compression === 1) return chunk;
      if (compression === 5) return lzwDecode(chunk, expectedBytes);
      return inflateChunk(chunk, expectedBytes, compression);
    };

    if (tiled) {
      const tw = this.#first(TAG.TileWidth);
      const th = this.#first(TAG.TileLength);
      const offsets = this.tags.get(TAG.TileOffsets);
      const counts = this.tags.get(TAG.TileByteCounts);
      const across = Math.ceil(width / tw);
      const down = Math.ceil(height / th);
      if (!offsets || offsets.length !== across * down) {
        throw new Error(`expected ${across * down} tiles, found ${offsets?.length ?? 0}`);
      }
      const tileBytes = tw * th * pixelBytes;
      for (let ti = 0; ti < offsets.length; ti++) {
        const tx = ti % across;
        const ty = (ti - tx) / across;
        const raw = decompress(offsets[ti], counts[ti], tileBytes);
        if (predictor === 2) undoPredictor2(raw, tw, th);
        const rowBytes = tw * pixelBytes;
        const usable = Math.min(tw, width - tx * tw);
        for (let r = 0; r < th; r++) {
          const gy = ty * th + r;
          if (gy >= height) break;
          const src = r * rowBytes;
          const dst = gy * width + tx * tw;
          for (let c = 0; c < usable; c++) {
            out[dst + c] = readSample(raw, src + c * pixelBytes);
          }
        }
      }
      this._pixels = out;
      return out;
    }

    const rowsPerStrip = this.#first(TAG.RowsPerStrip, height);
    const offsets = this.tags.get(TAG.StripOffsets);
    const counts = this.tags.get(TAG.StripByteCounts);
    const strips = Math.ceil(height / rowsPerStrip);
    if (!offsets || offsets.length < strips) {
      throw new Error(`expected ${strips} strips, found ${offsets?.length ?? 0}`);
    }
    const rowBytes = width * pixelBytes;
    for (let s = 0; s < strips; s++) {
      // The final strip is short: ImageLength need not divide RowsPerStrip
      // (101 / 10 leaves a single-row strip), and asking the decoder for a
      // full strip of rows makes a short stream look truncated.
      const rows = Math.min(rowsPerStrip, height - s * rowsPerStrip);
      const raw = decompress(offsets[s], counts[s], rowBytes * rows);
      if (predictor === 2) undoPredictor2(raw, width, rows);
      for (let r = 0; r < rows; r++) {
        const src = r * rowBytes;
        const dst = (s * rowsPerStrip + r) * width;
        for (let x = 0; x < width; x++) {
          out[dst + x] = readSample(raw, src + x * pixelBytes);
        }
      }
    }
    this._pixels = out;
    return out;
  }
}

/**
 * Read a GeoTIFF into samples + georeferencing.
 *
 * @returns {{
 *   width: number, height: number,
 *   pixels: Float64Array,
 *   nodata: number | null,
 *   geotransform: { originX: number, pixelW: number, rotX: number,
 *                   originY: number, rotY: number, pixelH: number } | null,
 *   crs: { kind: "geographic" | "projected" | null, epsg: number | null,
 *          label: string | null },
 *   compression: number, predictor: number, bitsPerSample: number,
 *   sampleFormat: number, container: string,
 * }}
 */
export function readTiff(buf) {
  const t = new GeoTiff(buf);
  const pixels = t.decode();
  return {
    width: t.width,
    height: t.height,
    pixels,
    nodata: t.nodata,
    geotransform: t.geotransform,
    crs: t.crs,
    compression: t.meta.compression,
    predictor: t.meta.predictor,
    bitsPerSample: t.meta.bps,
    sampleFormat: t.meta.sampleFormat,
    container: `${t.tif.big ? "BigTIFF" : "classic"} ${t.tif.le ? "LE" : "BE"}`,
  };
}

/** Is this cell real data? `nodata` may be null (no tag) or NaN-valued. */
export function isValidCell(v, nodata) {
  if (!Number.isFinite(v)) return false;
  if (nodata === null || Number.isNaN(nodata)) return true;
  return Math.abs(v - nodata) > 1e-6;
}

export { TAG };
