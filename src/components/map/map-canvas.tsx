"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MLMap,
  NavigationControl,
  AttributionControl,
  ScaleControl,
  setWorkerUrl,
  type MapLayerMouseEvent,
  type ErrorEvent,
  type GeoJSONSource,
  type Point,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { buildMapStyle, layerPaint } from "@/lib/maplibre-style";
import {
  fitBoundsOptions,
  mapCenter,
  mapLayers,
  mapZoom,
  type MapLayer,
  type VectorMapLayer,
} from "@/data/map-layers";

// MapLibre GL v6 needs an explicit worker URL in Next.js/Turbopack because
// the default blob-worker fallback is blocked. The prebuilt worker ships
// under node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs and is copied
// to /public/maplibre/ by scripts/sync-assets.mjs.
//
// Called unconditionally: `map-sandbox.tsx` only ever imports this module
// from a mount-gated effect, so it is never evaluated during SSR, and the
// call itself only records a string. A `typeof window` guard here would make
// the worker URL silently conditional for no benefit.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

type Props = {
  activeLayerId: string;
  /** Overlay opacity, 0-1. Ignored by vector layers. */
  opacity: number;
  onFeatureSelect: (
    layer: MapLayer,
    feature: GeoJSON.Feature | null,
    lngLat: { lng: number; lat: number } | null
  ) => void;
  onWebGLError?: (err: unknown) => void;
};

const SOURCE_ID = "active-layer";
const HIGHLIGHT_SOURCE_ID = "active-layer-hover";
const RASTER_LAYER_ID = `${SOURCE_ID}-raster`;
const FILL_LAYER_ID = `${SOURCE_ID}-fill`;
const LINE_LAYER_ID = `${SOURCE_ID}-line`;
const CIRCLE_LAYER_ID = `${SOURCE_ID}-circle`;
const HOVER_CIRCLE_LAYER_ID = `${HIGHLIGHT_SOURCE_ID}-circle`;
/**
 * GeoJSON overlay drawn above a raster layer (LiDAR stands over the CHM).
 * Its own source, because `SOURCE_ID` holds an *image* source while a
 * raster layer is active.
 */
const OVERLAY_SOURCE_ID = `${SOURCE_ID}-overlay`;
const OVERLAY_FILL_LAYER_ID = `${SOURCE_ID}-overlay-fill`;
const OVERLAY_LINE_LAYER_ID = `${SOURCE_ID}-overlay-line`;
const OVERLAY_CIRCLE_LAYER_ID = `${SOURCE_ID}-overlay-circle`;

const OVERLAY_LAYER_IDS = [
  OVERLAY_FILL_LAYER_ID,
  OVERLAY_LINE_LAYER_ID,
  OVERLAY_CIRCLE_LAYER_ID,
];

const OWN_LAYER_IDS = [
  RASTER_LAYER_ID,
  FILL_LAYER_ID,
  LINE_LAYER_ID,
  CIRCLE_LAYER_ID,
  HOVER_CIRCLE_LAYER_ID,
  ...OVERLAY_LAYER_IDS,
];

type Bounds = readonly [number, number, number, number];

export function MapCanvas({ activeLayerId, opacity, onFeatureSelect, onWebGLError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const activeLayerRef = useRef<MapLayer | null>(null);
  const [ready, setReady] = useState(false);
  const [degraded, setDegraded] = useState(false);

  /**
   * Callbacks are held in refs and refreshed after every render, so the
   * mount effect below can keep an empty dependency array. The parent
   * passes inline arrows, and listing them as deps used to tear the whole
   * map down and rebuild it on every parent re-render — which happens on
   * every feature click, because selecting a feature is parent state.
   */
  const onFeatureSelectRef = useRef(onFeatureSelect);
  const onWebGLErrorRef = useRef(onWebGLError);
  /**
   * Read by the layer-swap effect below, which must not re-run when the
   * slider moves. Declared here rather than next to its own effect so it is
   * never referenced before initialisation.
   */
  const opacityRef = useRef(opacity);
  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect;
    onWebGLErrorRef.current = onWebGLError;
    opacityRef.current = opacity;
  });

  const activeLayer = useMemo(
    () => mapLayers.find((l) => l.id === activeLayerId) ?? mapLayers[0],
    [activeLayerId]
  );

  const activeKind = activeLayer.kind;

  // Mount the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let canceled = false;
    const map = new MLMap({
      container,
      style: buildMapStyle(),
      center: mapCenter,
      zoom: mapZoom,
      attributionControl: false,
      cooperativeGestures: true,
      hash: false,
    });
    mapRef.current = map;

    map.addControl(
      new NavigationControl({ showCompass: false, visualizePitch: false }),
      "top-right"
    );
    map.addControl(
      new AttributionControl({ compact: true }),
      "bottom-right"
    );
    map.addControl(new ScaleControl({ unit: "metric", maxWidth: 120 }), "bottom-left");

    /**
     * Only a lost WebGL context means "this browser cannot run the map".
     * Tile and source failures (offline, 4xx from the tile host, blocked
     * third-party requests) arrive through the same `error` event, and
     * routing those to the caller's fallback used to replace a perfectly
     * good map with the "webgl unavailable" plate — permanently, after a
     * single flaky tile. Degrade the badge instead; the map stays.
     */
    map.on("error", (e: ErrorEvent) => {
      const err = (e as { error?: unknown }).error;
      if (err) {
        console.warn("[maplibre]", err);
        setDegraded(true);
      }
    });
    map.on("webglcontextlost", () => {
      onWebGLErrorRef.current?.(new Error("WebGL context lost"));
    });
    map.on("webglcontextrestored", () => {
      setDegraded(false);
    });

    map.on("load", () => {
      map.resize();
      if (!canceled) setReady(true);
    });

    // The container is sized by an `aspect-ratio` ancestor, so its height
    // is only known after layout. MapLibre measures once during
    // construction; without this it keeps a stale canvas size whenever the
    // box changes (viewport resize, sidebar toggling, font swap).
    const observer = new ResizeObserver(() => {
      if (!canceled) map.resize();
    });
    observer.observe(container);

    return () => {
      canceled = true;
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /**
   * Layer swapping, camera framing, and hit-testing live in one effect so the
   * layer ids used by `queryRenderedFeatures` can never drift out of sync
   * with the layers that are actually on the style.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    activeLayerRef.current = activeLayer;
    let aborted = false;

    const clearActive = () => {
      if (!mapRef.current) return;
      for (const id of OWN_LAYER_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      if (map.getSource(HIGHLIGHT_SOURCE_ID)) map.removeSource(HIGHLIGHT_SOURCE_ID);
      if (map.getSource(OVERLAY_SOURCE_ID)) map.removeSource(OVERLAY_SOURCE_ID);
    };

    const frame = (bounds: Bounds) => {
      if (!mapRef.current) return;
      // A degenerate footprint (a single point, or every feature at one
      // coordinate) makes fitBounds throw; fall back to a centred view.
      if (!(bounds[2] > bounds[0] && bounds[3] > bounds[1])) {
        map.easeTo({ center: [bounds[0], bounds[1]], zoom: 13, duration: 900 });
        return;
      }
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        fitBoundsOptions
      );
    };

    if (activeKind === "raster") {
      const spec = activeLayer.image;
      clearActive();
      const [west, south, east, north] = spec.bounds;
      map.addSource(SOURCE_ID, {
        type: "image",
        url: spec.url,
        // An image source takes all four corners clockwise from the north-west,
        // not a bbox: the corners let MapLibre reproject the image.
        coordinates: [
          [west, north],
          [east, north],
          [east, south],
          [west, south],
        ],
      });
      map.addLayer({
        id: RASTER_LAYER_ID,
        type: "raster",
        source: SOURCE_ID,
        paint: {
          "raster-opacity": opacityRef.current,
          // Colour is already baked per-pixel; cross-fading the overlay on
          // every tab switch reads as a flash with no meaning.
          "raster-fade-duration": 0,
        },
      });
      frame(spec.bounds);

      // Composite layer (LiDAR): stand polygons drawn above the CHM, with
      // their own source so the image source above is left alone. Framing
      // stays on the raster footprint — the overlay lives inside it.
      const overlay = activeLayer.overlay;
      if (overlay) {
        void (async () => {
          try {
            const res = await fetch(overlay.geojson);
            if (!res.ok) {
              throw new Error(`Failed to load ${overlay.geojson}: ${res.status}`);
            }
            const data = (await res.json()) as GeoJSON.FeatureCollection;
            if (aborted || mapRef.current !== map) return;
            upsertOverlayLayer(map, data, overlay);
          } catch (err) {
            console.warn("[maplibre] fetch", err);
          }
        })();
      }
    } else {
      void (async () => {
        try {
          const res = await fetch(activeLayer.geojson);
          if (!res.ok) {
            throw new Error(`Failed to load ${activeLayer.geojson}: ${res.status}`);
          }
          const data = (await res.json()) as GeoJSON.FeatureCollection;
          if (aborted || mapRef.current !== map) return;

          upsertActiveLayer(map, data, activeLayer);
          map.resize();
          const bounds = geojsonBounds(data);
          if (bounds) frame(bounds);
        } catch (err) {
          console.warn("[maplibre] fetch", err);
        }
      })();
    }

    /**
     * Query every layer that belongs to the clickable source: the geojson
     * source for pure-vector layers, the overlay source for a raster with
     * an overlay. This used to query `"active-layer"`, which is the *source*
     * id — never a layer id — so `queryRenderedFeatures` matched nothing and
     * clicking a feature silently did nothing.
     */
    const clickable = activeKind === "vector" || Boolean(activeLayer.overlay);
    const pickSource = activeKind === "vector" ? SOURCE_ID : OVERLAY_SOURCE_ID;
    const pickFeatures = (point: Point) => {
      const layers = map
        .getStyle()
        .layers.flatMap((l) =>
          "source" in l && l.source === pickSource && l.type !== "raster" ? [l.id] : []
        );
      if (layers.length === 0) return [];
      return map.queryRenderedFeatures(point, { layers });
    };

    const handleClick = (e: MapLayerMouseEvent) => {
      const f = pickFeatures(e.point)[0];
      onFeatureSelectRef.current(
        activeLayerRef.current!,
        f ? (f as unknown as GeoJSON.Feature) : null,
        e.lngLat
      );
    };

    let cursor = "";
    const handleMove = (e: MapLayerMouseEvent) => {
      if (!clickable) return;
      const next = pickFeatures(e.point).length > 0 ? "pointer" : "";
      if (next === cursor) return;
      cursor = next;
      map.getCanvas().style.cursor = next;
    };
    const handleLeave = () => {
      cursor = "";
      map.getCanvas().style.cursor = "";
    };

    if (clickable) {
      map.on("click", handleClick);
      map.on("mousemove", handleMove);
      map.on("mouseout", handleLeave);
    }

    return () => {
      aborted = true;
      map.off("click", handleClick);
      map.off("mousemove", handleMove);
      map.off("mouseout", handleLeave);
      clearActive();
    };
    // `opacity` is deliberately absent: it is applied by the effect below so
    // that dragging the slider does not re-add the layer every frame.
  }, [activeLayer, activeKind, ready]);

  // Opacity is a paint tweak, not a layer swap. Rebuilding the source on every
  // slider tick would re-download the PNG and restart the fade.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!map.getLayer(RASTER_LAYER_ID)) return;
    map.setPaintProperty(RASTER_LAYER_ID, "raster-opacity", opacity);
  }, [opacity, ready]);

  return (
    <div
      className="relative h-full w-full bg-background"
      aria-label="Interactive map of forestry sample data over Spain"
      role="application"
    >
      {/**
        MapLibre adds its own `maplibregl-map` class to this node, and that
        class carries `position: relative` with no width/height. Because the
        vendor stylesheet is unlayered while our utilities live in
        `@layer utilities`, it wins the cascade over `absolute` — so an
        `absolute inset-0` container collapses to zero height and the map
        renders nothing at all. An explicit `h-full w-full` survives the
        override because `.maplibregl-map` sets no height of its own.
      */}
      <div ref={containerRef} className="h-full w-full" />
      {degraded ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 border border-border bg-card/95 px-3 py-2 text-center font-mono text-xs text-muted-foreground">
          <span className="text-brand-strong">{"// map degraded"}</span>
          <br />tiles may be unreachable
        </div>
      ) : null}
    </div>
  );
}

/**
 * Idempotent upsert: removes any prior active/hover layer and source, then
 * writes the fresh ones in a way that MapLibre treats as updates.
 */
function upsertActiveLayer(
  map: MLMap,
  data: GeoJSON.FeatureCollection,
  layer: Extract<MapLayer, { kind: "vector" }>
) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data, promoteId: undefined });
  } else {
    (map.getSource(SOURCE_ID) as GeoJSONSource).setData(data);
  }
  if (!map.getSource(HIGHLIGHT_SOURCE_ID)) {
    map.addSource(HIGHLIGHT_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      promoteId: undefined,
    });
  } else {
    (map.getSource(HIGHLIGHT_SOURCE_ID) as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [],
    });
  }

  // remove existing top layers
  for (const id of OWN_LAYER_IDS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }

  switch (layer.paint) {
    case "fill":
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: layerPaint("fill"),
      });
      break;
    case "line":
      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: layerPaint("line"),
      });
      break;
    case "circle":
      map.addLayer({
        id: CIRCLE_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: layerPaint("circle"),
      });
      break;
    case "fill+line":
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: layerPaint("fill"),
      });
      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: layerPaint("line"),
      });
      break;
  }
}

/**
 * Wires the GeoJSON overlay above an active raster layer: one source plus
 * the layers its paint calls for — all at zero opacity.
 *
 * The overlay is invisible by design (the raster is the visual); clicks
 * still resolve to features because `queryRenderedFeatures` works on
 * geometry, not on painted pixels. Only `visibility: "none"` would remove
 * the layers from hit-testing, so opacity is the right lever.
 */
function upsertOverlayLayer(
  map: MLMap,
  data: GeoJSON.FeatureCollection,
  overlay: VectorMapLayer
) {
  if (!map.getSource(OVERLAY_SOURCE_ID)) {
    map.addSource(OVERLAY_SOURCE_ID, { type: "geojson", data, promoteId: undefined });
  } else {
    (map.getSource(OVERLAY_SOURCE_ID) as GeoJSONSource).setData(data);
  }

  for (const id of OVERLAY_LAYER_IDS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }

  if (overlay.paint === "fill" || overlay.paint === "fill+line") {
    map.addLayer({
      id: OVERLAY_FILL_LAYER_ID,
      type: "fill",
      source: OVERLAY_SOURCE_ID,
      paint: { ...layerPaint("fill"), "fill-opacity": 0 },
    });
  }
  if (overlay.paint === "line" || overlay.paint === "fill+line") {
    map.addLayer({
      id: OVERLAY_LINE_LAYER_ID,
      type: "line",
      source: OVERLAY_SOURCE_ID,
      paint: { ...layerPaint("line"), "line-opacity": 0 },
    });
  }
  if (overlay.paint === "circle") {
    map.addLayer({
      id: OVERLAY_CIRCLE_LAYER_ID,
      type: "circle",
      source: OVERLAY_SOURCE_ID,
      paint: {
        ...layerPaint("circle"),
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
      },
    });
  }
}

/**
 * Extent of a FeatureCollection, used to frame vector layers on open.
 * Handles Point / LineString / Polygon and its Multi* forms, walking
 * coordinates generically so a new geometry type cannot silently yield a
 * zero-area box.
 */
export function geojsonBounds(data: GeoJSON.FeatureCollection): Bounds | null {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  let seen = 0;

  const visit = (c: unknown): void => {
    if (!Array.isArray(c) || c.length === 0) return;
    if (typeof c[0] === "number") {
      const lng = c[0] as number;
      const lat = c[1] as number;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      seen++;
      if (lng < w) w = lng;
      if (lng > e) e = lng;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
      return;
    }
    for (const child of c) visit(child);
  };

  // A nested GeometryCollection can contain further GeometryCollections, so
// this recurses rather than assuming `coordinates` exists on every child.
  const visitGeometry = (g: GeoJSON.Geometry | null): void => {
    if (!g) return;
    if (g.type === "GeometryCollection") {
      for (const child of g.geometries) visitGeometry(child);
    } else if ("coordinates" in g) {
      visit(g.coordinates);
    }
  };

  for (const f of data.features) visitGeometry(f.geometry);

  return seen === 0 ? null : [w, s, e, n];
}