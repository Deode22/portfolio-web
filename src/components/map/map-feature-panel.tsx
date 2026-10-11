"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VectorMapLayer } from "@/data/map-layers";

type Props = {
  /** Vector only — image layers have no per-feature attributes to inspect. */
  layer: VectorMapLayer;
  feature: GeoJSON.Feature | null;
  lngLat: { lng: number; lat: number } | null;
  onClear: () => void;
};

export function MapFeaturePanel({ layer, feature, lngLat, onClear }: Props) {
  // hide on small viewports: map goes full-bleed, panel collapses into a
  // bottom sheet that is keyboard-reachable via the toggle bar's "feature
  // panel" disclosure on touch / small screens.
  const isOpen = feature !== null;

  return (
    <aside
      aria-label={`${layer.label} feature details`}
      className={cn("flex flex-col border border-rule bg-background", isOpen ? "" : "hidden")}
    >
      <div className="flex items-center justify-between border-b border-rule px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="label-mono text-brand-strong">{"// feature"}</span>
          <span className="font-mono text-xs text-foreground">
            {layer.shortLabel}
          </span>
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Close feature details"
          onClick={onClear}
          className="pressable text-muted-foreground hover:text-foreground"
        >
          <X />
        </Button>
      </div>

      {isOpen ? (
        <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-2 p-4 font-mono text-xs">
          {layer.properties.map((p) => {
            const raw = (feature?.properties as Record<string, unknown> | null)?.[
              p.key
            ];
            const formatted = formatValue(raw, p.precision);
            return (
              <PairItem key={p.key} label={p.label} value={formatted} suffix={p.suffix} />
            );
          })}
          {lngLat ? (
            <>
              <PairItem label="lng" value={lngLat.lng.toFixed(5)} />
              <PairItem label="lat" value={lngLat.lat.toFixed(5)} />
            </>
          ) : null}
        </dl>
      ) : null}
    </aside>
  );
}

function PairItem({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="numeric text-foreground">
        {value}
        {suffix ? <span className="ml-1 text-muted-foreground">{suffix}</span> : null}
      </dd>
    </>
  );
}

function formatValue(raw: unknown, precision?: number): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (typeof raw === "number") {
    if (precision === undefined) return String(raw);
    return raw.toFixed(precision);
  }
  return String(raw);
}

/**
 * Re-export so the screen-reader / no-WebGL fallback can reuse the formatter.
 */
export { formatValue as formatLayerValue };
