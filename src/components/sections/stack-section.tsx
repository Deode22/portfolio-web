import { skillGroups, stackIntro } from "@/data/skills";
import {
  SectionHeading,
  SectionLede,
  SectionShell,
} from "@/components/sections/section-shell";

/**
 * Ruled rows, one per group. Items sit in a multi-column list rather than a
 * middot-joined mono string — a twelve-item line is not scannable, and one
 * long line is not a layout.
 */
export function StackSection() {
  return (
    <SectionShell id="stack" readout={`${skillGroups.length} groups`}>
      <SectionHeading id="stack">The toolbox.</SectionHeading>
      <SectionLede>{stackIntro}</SectionLede>

      <div className="grid gap-px border border-rule bg-rule">
        {skillGroups.map((group) => (
          <section
            key={group.id}
            aria-label={group.label}
            className="grid gap-x-10 gap-y-4 bg-background px-5 py-6 sm:px-7 lg:grid-cols-[13rem_minmax(0,1fr)]"
          >
            <h3 className="label-mono text-brand-strong lg:pt-1">
              {group.label}
            </h3>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="flex items-baseline gap-2.5 text-sm leading-snug text-foreground/85"
                >
                  <span
                    aria-hidden
                    className="h-px w-2 shrink-0 translate-y-[-0.3em] bg-rule-strong"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SectionShell>
  );
}
