/**
 * Domain documentation for the map layers that ship a methodology, rendered
 * as collapsible accordions below the map (see
 * src/components/map/raster-docs.tsx).
 *
 * Copy and processing snippets are stored here rather than inside the
 * component so they stay data, not markup — the same rule the rest of
 * src/data/ follows. Snippets are the scripts that produced the exports,
 * verbatim (Earth Engine JS for the Sentinel-2 rasters, Python for LiDAR).
 */

export type RasterLayerDocs = {
  /** Methodology paragraphs, rendered as the first accordion item. */
  methodology: readonly string[];
  /** The processing script behind the layer, verbatim. */
  snippet: string;
  /** Accordion trigger text (e.g. "google earth engine export"). */
  snippetTitle: string;
  /** Caption row above the snippet (e.g. "// gee script"). */
  snippetLabel: string;
};

const HYDRIC_SNIPPET = `// Sentinel-2 Multi-temporal Hydric Anomaly (ΔNDMI)
var studyArea = geometry;

function maskS2clouds(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
  return image.updateMask(mask).divide(10000);
}

function addIndices(image) {
  var ndmi = image.normalizedDifference(['B8A', 'B11']).rename('NDMI');
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands([ndmi, ndvi]);
}

// 1. Summer Baseline (2023–2024)
var s2Baseline = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(studyArea)
  .filter(ee.Filter.calendarRange(6, 8, 'month'))
  .filterDate('2023-01-01', '2024-12-31')
  .map(maskS2clouds)
  .map(addIndices)
  .median();

// 2. Current Summer Target (2025)
var s2Current = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(studyArea)
  .filter(ee.Filter.calendarRange(6, 8, 'month'))
  .filterDate('2025-06-01', '2025-08-31')
  .map(maskS2clouds)
  .map(addIndices)
  .median();

// 3. Absolute Anomaly (ΔNDMI) masked to forest canopy
var deltaNDMI = s2Current.select('NDMI')
  .subtract(s2Baseline.select('NDMI'))
  .rename('delta_ndmi');

var forestMask = s2Baseline.select('NDVI').gte(0.35);

var finalMoistureAnomaly = deltaNDMI
  .updateMask(forestMask)
  .clip(studyArea);

Map.centerObject(studyArea, 13);
Map.addLayer(finalMoistureAnomaly, {
  min: -0.15,
  max: 0.10,
  palette: ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30']
}, 'Forest Hydric Anomaly (ΔNDMI)');`;

const DISTURBANCE_SNIPPET = `// Sentinel-2 Bi-temporal Disturbance Severity (dNBR)
var studyArea = geometry;

function maskS2clouds(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
  return image.updateMask(mask);
}

// Pre & Post disturbance composites
var preComposite = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(studyArea)
  .filterDate('2025-05-01', '2025-06-30')
  .map(maskS2clouds)
  .median();

var postComposite = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(studyArea)
  .filterDate('2026-09-01', '2026-09-30')
  .map(maskS2clouds)
  .median();

// dNBR = (NBR_pre - NBR_post) * 1000
var nbrPre = preComposite.normalizedDifference(['B8', 'B12']);
var nbrPost = postComposite.normalizedDifference(['B8', 'B12']);
var dNBR = nbrPre.subtract(nbrPost).multiply(1000);

// Severity classification clipped strictly to study geometry
var severity = ee.Image(0)
  .where(dNBR.gte(100).and(dNBR.lt(270)), 1)  // Low severity
  .where(dNBR.gte(270).and(dNBR.lt(660)), 2)  // Moderate severity
  .where(dNBR.gte(660), 3)                    // High severity
  .rename('severity_class')
  .clip(studyArea);

Map.centerObject(studyArea, 13);
Map.addLayer(severity, {
  min: 0,
  max: 3,
  palette: ['#2ca25f', '#ffeb80', '#fd8d3c', '#bd0026']
}, 'Disturbance Severity');`;

const LIDAR_SNIPPET = `# PNOA ALS ground normalization & indirect H -> D -> biomass route
import laspy
import numpy as np

las = laspy.read("pnoa_tile.laz")
ground = las.z[las.classification == 2]
veg = las.z[np.isin(las.classification, [3, 4, 5])]

# Ground-relative canopy height: DTM from ground returns, CHM = DSM - DTM
dtm_baseline = np.median(ground)
normalized_h = veg - dtm_baseline

p95_height = np.percentile(normalized_h[normalized_h > 0], 95)
fcc_cover = (np.sum(normalized_h > 2.0) / len(las.z)) * 100

# Inverted Chapman-Richards height-diameter curve (Pinus halepensis placeholder)
HD_A, HD_B, HD_C = 20.0, 0.035, 1.4
base = min((p95_height - 1.3) / HD_A, 1.0 - 1e-9)
d = -(1.0 / HD_B) * np.log(1.0 - base ** (1.0 / HD_C))  # cm

# Ruiz-Peinado, del Rio & Montero (2011) additive biomass system (kg/tree)
w_total = (0.0139 * d**2 * p95_height
           + (3.926 * (d - 27.5) if d > 27.5 else 0.0)
           + 4.257 + 0.00506 * d**2 * p95_height - 0.0722 * d * p95_height
           + 6.197 + 0.00932 * d**2 * p95_height - 0.0686 * d * p95_height
           + 0.0785 * d**2)

stems_ha = 500.0 * (fcc_cover / 100.0)
estimated_timber_volume = w_total * stems_ha / 1000.0`;

const GEE_DOCS = {
  snippetTitle: "google earth engine export",
  snippetLabel: "// gee script",
};

/** Methodology for the LiDAR tab: the CHM raster and its stand overlay. */
const LIDAR_DOCS: RasterLayerDocs = {
  methodology: [
    "Data source: PNOA ALS 3rd Coverage point clouds (0.5–4 pts/m²), classified — ground returns are class 2, canopy returns classes 3–5.",
    "Normalization: a Digital Terrain Model is derived from the ground returns (class 2) and a Digital Surface Model from the canopy returns (classes 3–5). Heights are normalized as CHM = DSM − DTM, which removes terrain elevation and leaves canopy height above ground.",
    "Zonal metrics per stand: the 95th percentile height (H_P95, always ground-relative — the DTM is subtracted point by point), the Fraction of Canopy Cover (FCC, share of returns above 2 m), mean height and point density, extracted with laspy/Python.",
    "Because ALS never measures diameter, the dominant Pinus halepensis height drives a regional height-diameter curve (inverted Chapman-Richards) and the recovered diameter feeds the additive biomass system of Ruiz-Peinado, del Río & Montero (2011) for the species. The per-tree total is scaled to the stand by an FCC-derived stem density and published as the estimated timber volume in the stand polygons of the LiDAR PNOA layer.",
    "Baked for the map: the source CHM GeoTIFF is a 500 × 500 float32 grid at 2 m in EPSG:25830. Nodata (−9999) renders transparent; the display domain is the 2nd–98th percentile snapped to a 5 m step, so the tallest crowns clamp to deep green while the manifest keeps the true 0–49.8 m extremes visible.",
  ],
  snippet: LIDAR_SNIPPET,
  snippetTitle: "python processing snippet",
  snippetLabel: "// laspy · numpy",
};

export const rasterDocs: Readonly<Record<string, RasterLayerDocs>> = {
  hydric: {
    ...GEE_DOCS,
    methodology: [
      "ΔNDMI is the absolute difference of Sentinel-2 NDMI — the Normalized Difference Moisture Index, (B8A − B11) / (B8A + B11) — between a multi-year summer baseline (2023–2024) and the 2025 target summer, so a single dry season cannot read as an anomaly on its own.",
      "Both sides are median composites of Jun–Aug observations from COPERNICUS/S2_SR_HARMONIZED with the Scene Classification cloud, shadow and cirrus classes (3, 8, 9, 10) removed and reflectance scaled by 10 000.",
      "The difference is masked by NDVI ≥ 0.35 measured on the baseline, which isolates true tree canopy from bare soil and stubble artefacts, then clipped to the management boundary. Brown is a moisture deficit against that baseline, teal a surplus, white no change.",
      "Baked for the map: the source GeoTIFF carries no GDAL_NODATA tag, so masked cells arrive as NaN and render transparent. The display domain is symmetric (−0.15 … +0.15) rather than the −0.15 … +0.10 used in Earth Engine, so the ramp's neutral white sits exactly on zero anomaly; magnitude comes from the 1st/99th percentile snapped to a 0.05 step.",
    ],
    snippet: HYDRIC_SNIPPET,
  },
  disturbance: {
    ...GEE_DOCS,
    methodology: [
      "dNBR is the difference between pre-event and post-event Sentinel-2 NBR — the Normalized Burn Ratio, (B8 − B12) / (B8 + B12) — multiplied by 1000, which converts the index difference into the standard USGS/Copernicus severity scale.",
      "The pre-event composite covers 2025-05-01 → 2025-06-30 and the post-event composite 2026-09-01 → 2026-09-30, both cloud-masked through the SCL classes 3, 8, 9 and 10 and clipped strictly to the parcel boundary.",
      "Thresholds place each cell in one of four tiers: below 100 unaffected / stable canopy, 100–270 low disturbance / defoliation, 270–660 moderate severity / canopy damage, at or above 660 high severity / stand loss. The layer is categorical, so the legend shows one swatch per tier with its share of the grid.",
      "Baked for the map: the source GeoTIFF declares GDAL_NODATA = 0.0, but class 0 fills the interior of the footprint rather than ringing it, so it is a real unaffected class — painted green instead of punched through as transparency.",
    ],
    snippet: DISTURBANCE_SNIPPET,
  },
  /**
   * The LiDAR tab (CHM raster + stand overlay) shows the ALS methodology
   * behind both the heights and the per-stand metrics.
   */
  lidar: LIDAR_DOCS,
};

/** Docs for a layer id, or null when the layer has none (e.g. erosion). */
export function rasterDocsFor(layerId: string): RasterLayerDocs | null {
  return rasterDocs[layerId] ?? null;
}
