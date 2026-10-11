"use client";

import { Droplets, Flame, Layers, Mountain } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { mapLayers, type MapLayer } from "@/data/map-layers";

type Props = {
  value: string;
  onValueChange: (id: string) => void;
};

const ICONS: Record<string, typeof Layers> = {
  hydric: Droplets,
  disturbance: Flame,
  erosion: Layers,
  lidar: Mountain,
};

export function MapLayerToggle({ value, onValueChange }: Props) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(v) => {
        // ToggleGroup may emit "" when re-clicking the active option; ignore.
        if (v) onValueChange(v);
      }}
      spacing={0}
      className="flex flex-wrap gap-px bg-rule p-px md:flex-nowrap"
      aria-label="Map layer"
    >
      {mapLayers.map((l) => (
        <ToggleIconItem key={l.id} layer={l} />
      ))}
    </ToggleGroup>
  );
}

function ToggleIconItem({ layer }: { layer: MapLayer }) {
  const Icon = ICONS[layer.id] ?? Layers;
  return (
    <ToggleGroupItem
      value={layer.id}
      aria-label={layer.label}
      title={layer.label}
      className="flex items-center gap-2 bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground data-[state=on]:text-foreground"
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="hidden md:inline">{layer.shortLabel}</span>
    </ToggleGroupItem>
  );
}
