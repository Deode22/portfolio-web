import type { StyleSpecification } from "maplibre-gl";

/**
 * ArcGIS World Imagery (no API key required).
 * Coordinates — bbox of Spain-continental roughly fits our mock data
 * (Madrid / Sierra de Guadarrama / El Pardo).
 *
 * The raster is "attenuated" via raster paint settings to drop into the
 * Terminal de campo palette: satellite imagery is warm/bright, which would
 * fight the burnt-oxide typography. Brightness compressed and saturation
 * reduced so labels stay legible and the GeoJSON layers read at a glance.
 */
const IMAGERY_TEMPLATE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export function buildMapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      "esri-imagery": {
        type: "raster",
        tiles: [IMAGERY_TEMPLATE],
        tileSize: 256,
        attribution:
          "Imagery © Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, Aerogrid, IGN, GIS User Community",
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "esri-imagery",
        type: "raster",
        source: "esri-imagery",
        paint: {
          "raster-saturation": -0.4,
          "raster-brightness-min": 0,
          "raster-brightness-max": 1,
          "raster-contrast": 0.05,
        },
      },
    ],
  };
}

/**
 * Per-layer paint specs to compose into an active style. Returns the flat
 * `paint` object for the layer type, so callers assign it directly to
 * `layer.paint` — an earlier nested `{ fill: {...} }` shape was spread into
 * the layer spec, which silently left `paint` unset and MapLibre fell back
 * to its default black fill.
 */
export function layerPaint(layerType: "fill"): { "fill-color": string; "fill-opacity": number };
export function layerPaint(layerType: "line"): { "line-color": string; "line-width": number };
export function layerPaint(layerType: "circle"): {
  "circle-color": string;
  "circle-radius": number;
  "circle-stroke-color": string;
  "circle-stroke-width": number;
};
export function layerPaint(layerType: "fill" | "line" | "circle") {
  switch (layerType) {
    case "fill":
      return { "fill-color": "#8C5A3A", "fill-opacity": 0.45 };
    case "line":
      return { "line-color": "#C08050", "line-width": 2 };
    case "circle":
      return {
        "circle-color": "#C08050",
        "circle-radius": 6,
        "circle-stroke-color": "#0A0B0A",
        "circle-stroke-width": 1.5,
      };
  }
}
