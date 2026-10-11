/**
 * The section registry is the single source of truth for section order,
 * index and label. Both the sticky navigation and the per-section rail read
 * from here, so an index can never drift out of sync with its nav entry.
 */
export type SectionId =
  | "hero"
  | "map"
  | "projects"
  | "experience"
  | "pipeline"
  | "stack"
  | "contact";

export type SectionMeta = {
  id: SectionId;
  /** Console index. Two digits, matches the nav readout. */
  index: string;
  label: string;
  /** Short label for the horizontal nav strip on small viewports. */
  navLabel: string;
};

export const sections: readonly SectionMeta[] = [
  { id: "hero", index: "01", label: "About", navLabel: "About" },
  { id: "map", index: "02", label: "Field Map", navLabel: "Map" },
  { id: "projects", index: "03", label: "Projects", navLabel: "Projects" },
  {
    id: "experience",
    index: "04",
    label: "Track Record",
    navLabel: "Record",
  },
  { id: "pipeline", index: "05", label: "Pipeline", navLabel: "Pipeline" },
  { id: "stack", index: "06", label: "Stack", navLabel: "Stack" },
  { id: "contact", index: "07", label: "Contact", navLabel: "Contact" },
] as const;

export function sectionMeta(id: SectionId): SectionMeta {
  const found = sections.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown section id: ${id}`);
  return found;
}
