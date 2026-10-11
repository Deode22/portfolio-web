import { projects, projectsIntro } from "@/data/projects";
import {
  FeaturedProject,
  ProjectRow,
} from "@/components/sections/project-entry";
import {
  SectionHeading,
  SectionLede,
  SectionShell,
} from "@/components/sections/section-shell";

/** Stable, deliberate order — the featured repo leads. */
const ORDER = [
  "rusle-cli",
  "extractor-aemet",
  "prophet-predicting",
  "plantation-field-modelling",
] as const;

export function ProjectsSection() {
  const sorted = ORDER.map((id) => projects.find((p) => p.id === id)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p)
  );
  const [featured, ...rest] = sorted;

  return (
    <SectionShell id="projects" readout={`${sorted.length} repos`}>
      <SectionHeading id="projects">Field-tested open source.</SectionHeading>
      <SectionLede>{projectsIntro}</SectionLede>

      {featured ? (
        <div className="border border-rule">
          <FeaturedProject project={featured} />
        </div>
      ) : null}

      {/* 1px gap over a rule-coloured plane draws the hairlines, so the index
          reflows to any column count without per-item border maths. */}
      {rest.length ? (
        <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <li key={p.id} className="bg-background">
              <ProjectRow project={p} />
            </li>
          ))}
        </ul>
      ) : null}
    </SectionShell>
  );
}
