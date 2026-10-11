"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { ChevronDown } from "lucide-react";

import {
  mapLayers,
  mapStatusCopy,
  defaultMapLayerId,
  vectorViewOf,
  type MapLayer as MapLayerData,
} from "@/data/map-layers";
import { MapLayerToggle } from "@/components/map/map-layer-toggle";
import { MapFeaturePanel } from "@/components/map/map-feature-panel";
import { MapLegend, MapOpacityControl } from "@/components/map/map-legend";
import { RasterDocs } from "@/components/map/raster-docs";
import { FeatureTable } from "@/components/map/feature-table";
import { cn } from "@/lib/utils";
import { detectWebGL } from "@/lib/webgl";

/**
 * `next/dynamic` with `ssr: false` is legal in a Client Component, but we
 * still get a hydration mismatch because the server renders the loading
 * state and the client moves past it. Loading the canvas via a mount-only
 * useEffect keeps both passes identical.
 */
export function MapSandbox() {
  const [MapCanvas, setMapCanvas] = useState<ComponentType<{
    activeLayerId: string;
    opacity: number;
    onFeatureSelect: (
      layer: MapLayerData,
      feature: GeoJSON.Feature | null,
      lngLat: { lng: number; lat: number } | null
    ) => void;
    onWebGLError?: (err: unknown) => void;
  }> | null>(null);

  useEffect(() => {
    let canceled = false;
    void import("@/components/map/map-canvas").then((mod) => {
      if (!canceled) setMapCanvas(() => mod.MapCanvas);
    });
    return () => {
      canceled = true;
    };
  }, []);
  const [activeId, setActiveId] = useState(defaultMapLayerId);
  const [feature, setFeature] = useState<GeoJSON.Feature | null>(null);
  const [lngLat, setLngLat] = useState<{ lng: number; lat: number } | null>(null);
  const [needsFallback, setNeedsFallback] = useState(false);
  /**
   * Overlay opacity, 0-1. Seeded from the *default* layer's own default rather
   * than a constant, and re-seeded whenever a different image layer becomes
   * active (raster → raster included), so switching tabs never leaves the
   * slider showing another layer's value.
   */
  const [opacity, setOpacity] = useState(() => {
    const first = mapLayers.find((l) => l.id === defaultMapLayerId);
    return first && first.kind === "raster" ? first.image.defaultOpacity : 0.6;
  });

  const activeLayer = useMemo(
    () => mapLayers.find((l) => l.id === activeId) ?? mapLayers[0],
    [activeId]
  );

  /**
   * The layer's per-feature view, when it has one: pure-vector layers
   * directly, a raster only when it declares an overlay (LiDAR stands over
   * the CHM). Drives the click inspector in the sidebar.
   */
  const featureLayer = vectorViewOf(activeLayer);

  // Reset the slider to the incoming layer's default. Vector layers ignore
  // opacity entirely, so the value is left untouched to avoid a pointless
  // re-render on every vector tab.
  const previousLayerId = useRef(activeLayer.id);
  useEffect(() => {
    if (activeLayer.kind === "raster" && activeLayer.id !== previousLayerId.current) {
      setOpacity(activeLayer.image.defaultOpacity);
    }
    previousLayerId.current = activeLayer.id;
  }, [activeLayer]);

  // Server and first client paint agree (canvas mounts) — only decide
  // whether to fall back *after* mount, otherwise hydration mismatches.
  // ESLint `react-hooks/set-state-in-effect` forbids synchronous setState
  // after render, so we kick the detection off inside a microtask inside
  // the effect; the first paint and the SSR pass always agree.
  const [webGL, setWebGL] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setWebGL(detectWebGL()), 0);
    return () => window.clearTimeout(id);
  }, []);
  const useFallback = needsFallback || !webGL;

  /**
   * Stable identities: `MapCanvas` mounts the MapLibre instance in an effect
   * keyed on these, so fresh arrows on every render would rebuild the map.
   * Functional updates keep them correct without listing state as a dep.
   */
  const handleFeatureSelect = useCallback(
    (
      _layer: MapLayerData,
      feature: GeoJSON.Feature | null,
      lngLat: { lng: number; lat: number } | null
    ) => {
      setFeature(feature);
      setLngLat(lngLat);
    },
    []
  );
  const handleWebGLError = useCallback(() => {
    setNeedsFallback(true);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule pb-3">
            <MapLayerToggle value={activeId} onValueChange={setActiveId} />
            <span className="label-mono text-muted-foreground">
              {activeLayer.attribution}
            </span>
          </div>

          <div
            role="application"
            aria-label={`${activeLayer.label} field map over satellite imagery`}
            className="relative aspect-[16/10] w-full overflow-hidden border border-rule bg-background"
          >
            {useFallback ? (
              <StatusPlate {...mapStatusCopy.noWebGL} />
            ) : MapCanvas ? (
              <MapCanvas
                activeLayerId={activeId}
                opacity={opacity}
                onFeatureSelect={handleFeatureSelect}
                onWebGLError={handleWebGLError}
              />
            ) : (
              <StatusPlate {...mapStatusCopy.loading} pulse />
            )}
            <noscript>
              <StatusPlate {...mapStatusCopy.noScript} />
            </noscript>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {featureLayer ? (
            <MapFeaturePanel
              layer={featureLayer}
              feature={feature}
              lngLat={lngLat}
              onClear={() => {
                setFeature(null);
                setLngLat(null);
              }}
            />
          ) : null}
          <MapLegend layer={activeLayer} />
          <MapOpacityControl layer={activeLayer} value={opacity} onChange={setOpacity} />
        </div>
      </div>

      <RasterDocs layerId={activeLayer.id} />

      {/* Same data the map shows, one disclosure away — keyboard reachable and
          announced, so the no-WebGL and screen-reader paths stay intact. */}
      <details className="group border border-rule bg-background">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 transition-colors duration-fast ease-console hover:bg-surface focus-visible:text-brand-strong [&::-webkit-details-marker]:hidden">
          <span className="label-mono text-brand-strong">
            {"// accessible feature table"}
          </span>
          <span className="flex items-center gap-3">
            <span className="label-mono hidden text-muted-foreground sm:inline">
              every layer, as plain tables
            </span>
            <ChevronDown
              aria-hidden
              className="size-4 text-muted-foreground transition-transform duration-base ease-console group-open:rotate-180"
            />
          </span>
        </summary>
        <FeatureTable activeLayerId={activeId} />
      </details>
    </div>
  );
}

function StatusPlate({
  title,
  body,
  pulse = false,
}: {
  title: string;
  body: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p
        className={cn(
          "label-mono text-brand-strong",
          pulse && "motion-safe:animate-pulse"
        )}
      >
        {title}
      </p>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
