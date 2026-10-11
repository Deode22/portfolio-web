import { experiences, experienceIntro } from "@/data/experience";
import {
  SectionHeading,
  SectionLede,
  SectionShell,
} from "@/components/sections/section-shell";

/**
 * A ledger, not a stack of cards: period on the left as a fixed-width
 * instrument column, the role on the right, hairline between rows.
 */
export function ExperienceSection() {
  return (
    <SectionShell id="experience" readout={`${experiences.length} roles`}>
      <SectionHeading id="experience">Where the work happened.</SectionHeading>
      <SectionLede>{experienceIntro}</SectionLede>

      <ol className="border-t border-rule">
        {experiences.map((e) => (
          <li
            key={e.company}
            className="grid gap-x-10 gap-y-3 border-b border-rule py-7 md:grid-cols-[9rem_minmax(0,1fr)]"
          >
            <div className="flex flex-col gap-1.5">
              <span className="numeric label-mono text-brand-strong">
                {e.period}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {e.location}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="headline text-xl leading-tight text-foreground">
                  {e.company}
                </h3>
                <p className="text-sm text-muted-foreground">{e.role}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {e.highlights.map((h) => (
                  <li
                    key={h}
                    className="relative pl-4 text-sm leading-relaxed text-foreground/85 before:absolute before:top-[0.6em] before:left-0 before:h-px before:w-2 before:bg-rule-strong"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
