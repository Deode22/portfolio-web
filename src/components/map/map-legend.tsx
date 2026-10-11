"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  paintLegend,
  type MapLayer,
  type RasterMapLayer,
} from "@/data/map-layers";

/**
 * The visual key for the active layer, rendered beside the map rather than
 * inside it, so it stays readable at every zoom level and never covers data.
 */
export function MapLegend({ layer }: { layer: MapLayer }) {
  return (
    <div className="border border-rule bg-background p-4">
      <span className="label-mono text-brand-strong">{"// legend"}</span>
      {layer.kind === "raster" ? (
        <RasterLegend layer={layer} />
      ) : (
        <VectorLegend layer={layer} />
      )}
    </div>
  );
}

function VectorLegend({ layer }: { layer: Extract<MapLayer, { kind: "vector" }> }) {
  const entry = paintLegend[layer.paint];
  return (
    <>
      <ul className="mt-3 flex flex-col gap-2 font-mono text-xs text-muted-foreground">
        <li className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={
              entry.swatch === "block"
                ? "inline-block size-3 border border-brand-strong bg-primary"
                : entry.swatch === "dot"
                  ? "inline-block size-3 rounded-full border border-brand-strong bg-background"
                  : "inline-block h-0 w-4 border-t-2 border-brand-strong"
            }
          />
          <span>{entry.label}</span>
        </li>
      </ul>
      <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
        {layer.description}
      </p>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        click a feature to read its attributes
      </p>
    </>
  );
}

function RasterLegend({ layer }: { layer: RasterMapLayer }) {
  const { image } = layer;
  const unit = image.unit ? ` ${image.unit}` : "";

  // Categorical layers (disturbance severity) have no value gradient: the
  // legend is one swatch per class, labelled with its own name and share.
  if (image.classes?.length) {
    return (
      <>
        <ul className="mt-3 flex flex-col gap-2 font-mono text-xs text-muted-foreground">
          {image.classes.map((c) => (
            <li key={c.value} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="inline-block size-3 shrink-0 border border-rule"
                style={{ backgroundColor: c.hex }}
              />
              <span className="numeric tabular-nums text-foreground">{c.value}</span>
              <span className="min-w-0 truncate">{c.label}</span>
              <span className="ml-auto numeric tabular-nums">{c.share}%</span>
            </li>
          ))}
        </ul>
        {image.note ? <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">{image.note}</p> : null}
        <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {layer.description}
        </p>
      </>
    );
  }

  const gradient = image.ramp
    .map((stop) => `${stop.hex} ${Math.round(stop.at * 100)}%`)
    .join(", ");

  return (
    <>
      <div
        className="mt-3 h-3 w-full border border-rule"
        style={{ backgroundImage: `linear-gradient(90deg, ${gradient})` }}
        role="img"
        aria-label={`Colour ramp from ${image.min} to ${image.max}${unit}`}
      />
      {/**
        Tick labels sit at the position their value actually occupies on the
        display scale. On a log ramp that is not linear in value, so these
        offsets come pre-computed from the build script rather than being
        guessed here.
      */}
      <div className="relative mt-1 h-4 font-mono text-[0.625rem] text-muted-foreground">
        {image.ticks.map((tick) => (
          <span
            key={tick.value}
            className="absolute -translate-x-1/2 tabular-nums"
            style={{ left: `${tick.at * 100}%` }}
          >
            {formatTick(tick.value)}
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.625rem] text-muted-foreground">
        <span className="tabular-nums">{image.min}</span>
        <span className="tabular-nums">{image.max}</span>
      </div>
      {image.note ? (
        <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {image.note}
        </p>
      ) : null}
      <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">
        {layer.description}
      </p>
    </>
  );
}

/**
 * Opacity control for image layers. Vector layers have no overlay to fade, so
 * the control is not rendered for them at all.
 */
export function MapOpacityControl({
  layer,
  value,
  onChange,
}: {
  layer: MapLayer;
  value: number;
  onChange: (next: number) => void;
}) {
  if (layer.kind !== "raster") return null;
  const id = `${layer.id}-overlay-opacity`;

  return (
    <div className="border border-rule bg-background p-4">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="label-mono text-brand-strong">
          {"// overlay opacity"}
        </Label>
        <span className="numeric font-mono text-xs text-foreground">
          {Math.round(value * 100)}%
        </span>
      </div>
      <Slider
        id={id}
        className="mt-3"
        min={0}
        max={100}
        step={1}
        value={[Math.round(value * 100)]}
        onValueChange={(next) => {
          const v = next[0];
          if (typeof v === "number") onChange(v / 100);
        }}
      />
      <div className="mt-2 flex justify-between font-mono text-[0.625rem] text-muted-foreground">
        <span>imagery only</span>
        <span>full colour</span>
      </div>
    </div>
  );
}

/** 1 / 10 / 100 read better without trailing noise than with it. */
function formatTick(value: number): string {
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return String(Math.round(value));
  return String(Math.round(value * 100) / 100);
}