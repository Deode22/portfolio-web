import {
  disturbanceBounds,
  disturbanceCenter,
  disturbanceClasses,
  disturbanceDefaultOpacity,
  disturbanceGrid,
  disturbancePngPath,
  disturbanceRamp,
  disturbanceRange,
} from "@/data/disturbance-raster.generated";
import {
  hydricBounds,
  hydricCenter,
  hydricDefaultOpacity,
  hydricGrid,
  hydricPngPath,
  hydricRange,
  hydricRamp,
  hydricTicks,
} from "@/data/hydric-raster.generated";
import {
  lidarBounds,
  lidarCenter,
  lidarDefaultOpacity,
  lidarGrid,
  lidarPngPath,
  lidarRange,
  lidarRamp,
  lidarTicks,
} from "@/data/lidar-raster.generated";
import {
  rusleBounds,
  rusleCenter,
  rusleDefaultOpacity,
  rusleGrid,
  ruslePngPath,
  rusleRange,
  rusleRamp,
  rusleTicks,
} from "@/data/rusle-raster.generated";

/**
 * Map layer definitions.
 *
 * Two kinds of layer:
 *   - `vector`: GeoJSON fetched at runtime, painted with `layerPaint()`, and
 *     clickable for per-feature attributes.
 *   - `raster`: a build-time-baked image over a known WGS84 footprint, with
 *     no per-feature attributes — unless it declares an `overlay`, a GeoJSON
 *     drawn above the raster whose features click open the feature panel
 *     (see `vectorViewOf()`).
 *
 * The overlay GeoJSON is still a mocked placeholder (see
 * public/geojson/README.md); replace it with real data when available. All
 * four raster layers are *not* mocked: each is the real GeoTIFF in
 * public/rasters, baked to a colormapped PNG by the scripts wired into
 * `npm run rasters:build`.
 */
export type MapLayerPaint = "fill" | "line" | "circle" | "fill+line";

export type MapLayerProperty = {
  key: string;
  label: string;
  unit?: string;
  /** Optional suffix appended after the formatted value (e.g. " t/ha·yr"). */
  suffix?: string;
  /** Format applied to numeric values when rendered in the feature panel. */
  precision?: number;
};

/** One categorical class (disturbance severity tiers). */
export type MapRasterClass = {
  value: number;
  hex: string;
  label: string;
  count: number;
  /** Percentage of the grid's painted cells covered by this class. */
  share: number;
};

/** Everything the legend and the opacity control need for an image layer. */
export type MapRasterSpec = {
  url: string;
  /** [west, south, east, north] in WGS84. */
  bounds: readonly [number, number, number, number];
  ramp: readonly { at: number; hex: string }[];
  /** Legend ticks, `at` already normalised onto the 0-1 gradient. */
  ticks: readonly { value: number; at: number }[];
  /** Displayed range, already trimmed by the build script. */
  min: number;
  max: number;
  scale: "log" | "linear" | "categorical";
  /** Unit shown in the legend's aria text (e.g. "ΔNDMI", "t/ha/yr"). */
  unit?: string;
  /** One-line display note under the legend (e.g. scale + trimming rules). */
  note?: string;
  /** Present on categorical layers; the legend renders swatches instead of a gradient. */
  classes?: readonly MapRasterClass[];
  defaultOpacity: number;
  /** Rows for the raster summary, shown next to (or instead of) the feature table. */
  summary: readonly { label: string; value: string }[];
};

type MapLayerBase = {
  id: string;
  label: string;
  shortLabel: string;
  attribution?: string;
  /** Copied into the toggle tooltip / aria description. */
  description: string;
};

export type VectorMapLayer = MapLayerBase & {
  kind: "vector";
  geojson: string;
  paint: MapLayerPaint;
  /** Property keys (in order) to display in the right-side feature panel. */
  properties: MapLayerProperty[];
};

export type RasterMapLayer = MapLayerBase & {
  kind: "raster";
  image: MapRasterSpec;
  /**
   * Optional GeoJSON drawn *above* the raster. This is how the LiDAR tab
   * shows the CHM backdrop with clickable stand polygons: the raster
   * provides the continuous view, the overlay provides the per-feature
   * click inspector, feature table and cursor affordance.
   */
  overlay?: VectorMapLayer;
};

export type MapLayer = VectorMapLayer | RasterMapLayer;

/** Narrowing helper for consumers that iterate over every layer. */
export function isRasterLayer(layer: MapLayer): layer is RasterMapLayer {
  return layer.kind === "raster";
}

/** Narrowing helper for consumers that iterate over every layer. */
export function isVectorLayer(layer: MapLayer): layer is VectorMapLayer {
  return layer.kind === "vector";
}

/**
 * The per-feature view of a layer, if it has one: the layer itself when it
 * is pure vector, or the GeoJSON overlay drawn above a raster. Consumers
 * (feature panel, feature table, click hit-testing) ask for this instead of
 * branching on `kind`, so a raster with an overlay behaves like a vector
 * layer wherever attributes matter.
 */
export function vectorViewOf(layer: MapLayer): VectorMapLayer | null {
  if (layer.kind === "vector") return layer;
  return layer.overlay ?? null;
}

export const mapIntro =
  "A tilted-down satellite basemap with the same layer types my pipelines publish. Toggle a layer, then click a feature to read its attributes.";

/** Copy for the three non-live map states. */
export const mapStatusCopy = {
  loading: {
    title: "// loading field map",
    body: "Fetching basemap tiles.",
  },
  noWebGL: {
    title: "// webgl unavailable",
    body: "This browser does not provide a usable WebGL context. Every layer's feature data is available in the table below.",
  },
  noScript: {
    title: "// javascript required",
    body: "The same feature data is listed in the table below.",
  },
} as const;

/** Legend rows for the vector paints, so the legend is derived, not hardcoded. */
export const paintLegend: Record<
  MapLayerPaint,
  { swatch: string; label: string }
> = {
  fill: { swatch: "block", label: "polygon · filled" },
  line: { swatch: "line", label: "line · 2px burnt oxide" },
  circle: { swatch: "dot", label: "point · outlined markers" },
  "fill+line": { swatch: "block", label: "polygon · fill + outline" },
};

export const mapLayers: MapLayer[] = [
  {
    kind: "raster",
    id: "hydric",
    label: "Hydric Risk & Moisture",
    shortLabel: "Hydric Risk · GEE",
    description:
      "Multi-temporal moisture stress (ΔNDMI) evaluated against a multi-year baseline (2023–2024 vs. 2025) to detect canopy physiological decline, clipped to management boundaries.",
    attribution: "Sentinel-2 · ΔNDMI · GEE export",
    image: {
      url: hydricPngPath,
      bounds: hydricBounds,
      ramp: hydricRamp,
      ticks: hydricTicks,
      min: hydricRange.min,
      max: hydricRange.max,
      scale: hydricRange.scale,
      unit: hydricRange.unit,
      note: "linear · divergent · white = 0 · domain p1/p99",
      defaultOpacity: hydricDefaultOpacity,
      summary: [
        { label: "Variable", value: hydricRange.label },
        {
          label: "Displayed range",
          value: `${hydricRange.min} … ${hydricRange.max} ${hydricRange.unit}`,
        },
        { label: "Median cell", value: `${hydricRange.median} ${hydricRange.unit}` },
        {
          label: "True extremes",
          value: `${hydricRange.trueMin} … ${hydricRange.trueMax} ${hydricRange.unit}`,
        },
        { label: "Scale", value: "linear, divergent (neutral at 0)" },
        { label: "Grid", value: `${hydricGrid.width} × ${hydricGrid.height} @ ${hydricGrid.pixelSizeMetres} m` },
        { label: "Cells with data", value: `${hydricRange.paintedCells} of ${hydricGrid.width * hydricGrid.height}` },
        { label: "Source CRS", value: hydricGrid.crs },
        { label: "Footprint centre", value: `${hydricCenter[0].toFixed(4)}, ${hydricCenter[1].toFixed(4)}` },
      ],
    },
  },
  {
    kind: "raster",
    id: "disturbance",
    label: "Disturbance & Severity",
    shortLabel: "Disturbance · GEE",
    description:
      "Bi-temporal differenced Normalized Burn Ratio (dNBR) monitoring abrupt canopy loss, classified by severity standards to audit permanence risk in ARR carbon projects.",
    attribution: "Sentinel-2 · dNBR · GEE export",
    image: {
      url: disturbancePngPath,
      bounds: disturbanceBounds,
      // Categorical: the legend shows `classes` as swatches, not this gradient.
      ramp: disturbanceRamp,
      ticks: [],
      min: disturbanceRange.min,
      max: disturbanceRange.max,
      scale: disturbanceRange.scale,
      unit: disturbanceRange.unit,
      note: "categorical · 4 dNBR severity classes",
      classes: disturbanceClasses,
      defaultOpacity: disturbanceDefaultOpacity,
      summary: [
        { label: "Variable", value: disturbanceRange.label },
        { label: "Scale", value: "categorical · 0–3 dNBR severity tiers" },
        ...disturbanceClasses.map((c) => ({
          label: `${c.value} · ${c.label}`,
          value: `${c.share}% · ${c.count} cells`,
        })),
        { label: "Grid", value: `${disturbanceGrid.width} × ${disturbanceGrid.height} @ ${disturbanceGrid.pixelSizeMetres} m` },
        { label: "Cells with data", value: `${disturbanceRange.paintedCells} of ${disturbanceGrid.width * disturbanceGrid.height}` },
        { label: "Source CRS", value: disturbanceGrid.crs },
        { label: "Footprint centre", value: `${disturbanceCenter[0].toFixed(4)}, ${disturbanceCenter[1].toFixed(4)}` },
      ],
    },
  },
  {
    kind: "raster",
    id: "erosion",
    label: "Erosion (RUSLE)",
    shortLabel: "RUSLE",
    description:
      "Modelled soil loss (RUSLE A) over the study area, baked from the source GeoTIFF at build time. Drag the opacity control to read it against the imagery.",
    attribution: "RUSLE A · 10 m grid · source GeoTIFF",
    image: {
      url: ruslePngPath,
      bounds: rusleBounds,
      ramp: rusleRamp,
      ticks: rusleTicks,
      min: rusleRange.min,
      max: rusleRange.max,
      scale: rusleRange.scale,
      unit: rusleRange.unit,
      note: "log · 2nd–98th pct of valid cells",
      defaultOpacity: rusleDefaultOpacity,
      summary: [
        { label: "Variable", value: rusleRange.label },
        {
          label: "Displayed range",
          value: `${rusleRange.min} – ${rusleRange.max} ${rusleRange.unit}`,
        },
        { label: "Median cell", value: `${rusleRange.median} ${rusleRange.unit}` },
        { label: "Scale", value: `${rusleRange.scale}, 2nd–98th pct` },
        { label: "Grid", value: `${rusleGrid.width} × ${rusleGrid.height} @ ${rusleGrid.pixelSizeMetres} m` },
        { label: "Cells with data", value: `${rusleRange.paintedCells} of ${rusleGrid.width * rusleGrid.height}` },
        { label: "Source CRS", value: rusleGrid.crs },
        { label: "Footprint centre", value: `${rusleCenter[0].toFixed(4)}, ${rusleCenter[1].toFixed(4)}` },
      ],
    },
  },
  {
    kind: "raster",
    id: "lidar",
    label: "Canopy Structure & LiDAR",
    shortLabel: "LiDAR PNOA",
    description:
      "Canopy Height Model (CHM) and structural forestry metrics derived from official PNOA ALS point clouds (IGN Spain) using laspy and Python. The stands are invisible — click the canopy to read their structural metrics.",
    attribution: "PNOA LiDAR (IGN Spain) · Processed with Python & laspy",
    image: {
      url: lidarPngPath,
      bounds: lidarBounds,
      ramp: lidarRamp,
      ticks: lidarTicks,
      min: lidarRange.min,
      max: lidarRange.max,
      scale: lidarRange.scale,
      unit: lidarRange.unit,
      note: "linear · 2nd–98th pct snapped to 5 m",
      defaultOpacity: lidarDefaultOpacity,
      summary: [
        { label: "Variable", value: lidarRange.label },
        {
          label: "Displayed range",
          value: `${lidarRange.min} – ${lidarRange.max} ${lidarRange.unit}`,
        },
        { label: "Median cell", value: `${lidarRange.median} ${lidarRange.unit}` },
        {
          label: "True extremes",
          value: `${lidarRange.trueMin} … ${lidarRange.trueMax} ${lidarRange.unit}`,
        },
        { label: "Scale", value: "linear, 2nd–98th pct snapped to 5 m" },
        { label: "Grid", value: `${lidarGrid.width} × ${lidarGrid.height} @ ${lidarGrid.pixelSizeMetres} m` },
        { label: "Cells with data", value: `${lidarRange.paintedCells} of ${lidarGrid.width * lidarGrid.height}` },
        { label: "Source CRS", value: lidarGrid.crs },
        { label: "Footprint centre", value: `${lidarCenter[0].toFixed(4)}, ${lidarCenter[1].toFixed(4)}` },
      ],
    },
    overlay: {
      kind: "vector",
      id: "lidar-stands",
      label: "LiDAR PNOA stands",
      shortLabel: "LiDAR PNOA",
      description:
        "Stand polygons rendered at zero opacity — hit-test only; the CHM is the visual.",
      geojson: "/geojson/lidar-canopy-metrics.geojson",
      paint: "fill+line",
      properties: [
        { key: "stand_id", label: "Stand ID" },
        { key: "dominant_species", label: "Dominant Species" },
        { key: "p95_height", label: "Canopy Height (P95)", suffix: " m", precision: 1 },
        { key: "canopy_cover_fcc", label: "Canopy Cover (FCC)", suffix: "%", precision: 1 },
        {
          key: "estimated_timber_volume",
          label: "Estimated Timber Volume",
          suffix: " m³/ha",
          precision: 1,
        },
        { key: "point_density", label: "Sampling Density", suffix: " pts/m²", precision: 2 },
      ],
      attribution: "PNOA LiDAR (IGN Spain) · Processed with Python & laspy",
    },
  },
];

export const defaultMapLayerId = "hydric";

/**
 * Zoom limits for the automatic per-tab framing. Vector layers are point or
 * parcel scale; the rasters are 2 km–10 km footprints, so they need to be
 * allowed much closer without the fit zooming to a single 10 m pixel.
 */
export const fitBoundsOptions = {
  padding: { top: 48, bottom: 48, left: 48, right: 48 },
  duration: 900,
  maxZoom: 16,
} as const;

/**
 * The default camera is fitted to the default layer's footprint so the page
 * opens on real data instead of a hardcoded city centre. Per-tab framing still
 * runs in `map-canvas.tsx` (fitBounds on every swap); this only seeds the
 * pre-hydration view.
 */
function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI);
}

/** Web Mercator zoom that fits a WGS84 footprint into a nominal viewport. */
function fitZoomForBounds(
  bounds: readonly [number, number, number, number],
  viewport: { width: number; height: number }
): number {
  const x0 = (bounds[0] + 180) / 360;
  const x1 = (bounds[2] + 180) / 360;
  const y0 = mercatorY(bounds[3]);
  const y1 = mercatorY(bounds[1]);
  const zx = Math.log2(viewport.width / (Math.max(x1 - x0, 1e-9) * 512));
  const zy = Math.log2(viewport.height / (Math.max(y1 - y0, 1e-9) * 512));
  return Math.min(zx, zy);
}

const defaultLayer = mapLayers.find((l) => l.id === defaultMapLayerId) ?? mapLayers[0];
const defaultBounds = isRasterLayer(defaultLayer)
  ? defaultLayer.image.bounds
  : rusleBounds;
const DEFAULT_VIEWPORT = { width: 1000, height: 625 };

/** [lng, lat] of the default layer's footprint centre. */
export const mapCenter: [number, number] = [
  (defaultBounds[0] + defaultBounds[2]) / 2,
  (defaultBounds[1] + defaultBounds[3]) / 2,
];
export const mapZoom = Math.min(
  fitBoundsOptions.maxZoom,
  fitZoomForBounds(defaultBounds, DEFAULT_VIEWPORT)
);

export const mapAttributionHtml = "Imagery © Esri · Data © contributors";
