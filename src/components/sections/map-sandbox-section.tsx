import { mapIntro } from "@/data/map-layers";
import { MapSandbox } from "@/components/map/map-sandbox";
import {
  SectionHeading,
  SectionLede,
  SectionShell,
} from "@/components/sections/section-shell";

export function MapSandboxSection() {
  return (
    <SectionShell id="map" readout="Spain / 3 sites" tone="surface">
      <div className="flex flex-col gap-5">
        <SectionHeading id="map">Read the terrain, not a screenshot.</SectionHeading>
        <SectionLede>{mapIntro}</SectionLede>
      </div>
      <MapSandbox />
    </SectionShell>
  );
}
