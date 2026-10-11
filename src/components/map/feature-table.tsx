"use client";

import { Fragment, useEffect, useState } from "react";

import {
  isRasterLayer,
  mapLayers,
  vectorViewOf,
  type RasterMapLayer,
  type VectorMapLayer,
} from "@/data/map-layers";
import { formatLayerValue } from "@/components/map/map-feature-panel";

type FeatureRecord = {
  layer: VectorMapLayer;
  features: GeoJSON.Feature[];
  loading: boolean;
  error?: string;
};

/**
 * A keyboard / screen-reader / no-WebGL fallback that renders the same
 * feature data the map would show, as plain tables. Hidden until needed.
 */
export function FeatureTable({ activeLayerId }: { activeLayerId: string }) {
  const [records, setRecords] = useState<Record<string, FeatureRecord>>({});

  useEffect(() => {
    let canceled = false;
    (async () => {
      const next: Record<string, FeatureRecord> = {};
      for (const layer of mapLayers) {
        // Pure rasters have no per-feature attributes to tabulate; they get
        // a summary table instead, rendered without any fetch. A raster with
        // an overlay (LiDAR) still fetches the overlay's features.
        const view = vectorViewOf(layer);
        if (!view) continue;
        next[view.id] = { layer: view, features: [], loading: true };
        try {
          const res = await fetch(view.geojson);
          if (!res.ok) throw new Error(`${res.status}`);
          const data = (await res.json()) as GeoJSON.FeatureCollection;
          if (canceled) return;
          next[view.id] = { layer: view, features: data.features, loading: false };
        } catch (err) {
          if (canceled) return;
          next[view.id] = {
            layer: view,
            features: [],
            loading: false,
            error: (err as Error).message,
          };
        }
      }
      if (!canceled) setRecords(next);
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const focused = activeLayerId;

  return (
    <div className="border-t border-rule">
      <div className="space-y-6 p-4">
        {mapLayers.map((layer) => {
          const view = vectorViewOf(layer);
          return (
            <Fragment key={layer.id}>
              {isRasterLayer(layer) ? (
                <RasterSummaryTable layer={layer} isActive={layer.id === focused} />
              ) : null}
              {view ? (
                <VectorTable
                  record={records[view.id]}
                  isActive={layer.id === focused}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function RasterSummaryTable({
  layer,
  isActive,
}: {
  layer: RasterMapLayer;
  isActive: boolean;
}) {
  return (
    <section aria-label={`${layer.label} raster summary`} className={isActive ? "" : "text-muted-foreground"}>
      <h3 className="label-mono mb-2 text-brand-strong">{layer.label}</h3>
      <p className="mb-2 font-mono text-xs text-muted-foreground">
        Continuous grid, not discrete features: the table below summarises the
        raster instead of listing every cell.
      </p>
      <div className="overflow-x-auto border border-rule">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="bg-surface text-muted-foreground">
              <th className="border-b border-rule px-2 py-1 text-left font-normal">Field</th>
              <th className="border-b border-rule px-2 py-1 text-left font-normal">Value</th>
            </tr>
          </thead>
          <tbody>
            {layer.image.summary.map((row) => (
              <tr
                key={row.label}
                className="transition-colors duration-fast ease-console even:bg-surface/60 hover:bg-surface"
              >
                <td className="border-b border-rule px-2 py-1 text-muted-foreground">{row.label}</td>
                <td className="border-b border-rule px-2 py-1">
                  <span className="numeric">{row.value}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VectorTable({
  record,
  isActive,
}: {
  record: FeatureRecord | undefined;
  isActive: boolean;
}) {
  if (!record) {
    return (
      <section className={isActive ? "" : "text-muted-foreground"}>
        <h3 className="label-mono mb-2 text-brand-strong">(loading)</h3>
        <div className="h-16 border border-rule bg-surface/50 motion-safe:animate-pulse" />
      </section>
    );
  }

  const { layer, features, loading, error } = record;

  return (
    <section
      aria-label={`${layer.label} features`}
      className={isActive ? "" : "text-muted-foreground"}
    >
      <h3 className="label-mono mb-2 text-brand-strong">
        {layer.label} {loading ? "(loading)" : ""}
        {error ? `(${error})` : ""}
      </h3>
      {features.length ? (
        <div className="overflow-x-auto border border-rule">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-surface text-muted-foreground">
                <th className="border-b border-rule px-2 py-1 text-left font-normal">#</th>
                {layer.properties.map((p) => (
                  <th
                    key={p.key}
                    className="border-b border-rule px-2 py-1 text-left font-normal"
                  >
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr
                  key={i}
                  className="transition-colors duration-fast ease-console even:bg-surface/60 hover:bg-surface"
                >
                  <td className="border-b border-rule px-2 py-1">{i + 1}</td>
                  {layer.properties.map((p) => {
                    const v = (f.properties as Record<string, unknown> | null)?.[p.key];
                    return (
                      <td key={p.key} className="border-b border-rule px-2 py-1">
                        <span className="numeric">{formatLayerValue(v, p.precision)}</span>
                        {p.suffix ? (
                          <span className="ml-1 text-muted-foreground">{p.suffix}</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : loading ? (
        <div className="h-16 border border-rule bg-surface/50 motion-safe:animate-pulse" />
      ) : (
        <p className="font-mono text-xs text-muted-foreground">
          no features in this layer
        </p>
      )}
    </section>
  );
}
