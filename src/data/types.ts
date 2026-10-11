/**
 * Stub types re-exported from the data layer so consumers can import from
 * a single place. Concrete shapes live with their data files in src/data/.
 */
export type { SiteCopy } from "./profile";
export type { SectionId, SectionMeta } from "./sections";
export type { Stat } from "./stats";
export type { Experience } from "./experience";
export type { Project, ProjectSpan } from "./projects";
export type { SkillGroup } from "./skills";
export type { PipelineNode } from "./pipeline";
export type {
  MapLayer,
  MapLayerPaint,
  MapLayerProperty,
} from "./map-layers";
