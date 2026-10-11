import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { sectionMeta, type SectionId } from "@/data/sections";
import { Reveal } from "@/components/sections/section-reveal";
import { SectionDrift } from "@/components/sections/section-drift";

/**
 * Shared section chrome. The left rail turns what used to be six duplicated
 * "01 �?" Label" kickers into a structural column: console index, label, live
 * readout, and a hairline that runs the full section height. One measure, one
 * vertical rhythm, one source of truth for the index.
 *
 * Stays a Server Component: `SectionHeading` receives the section id
 * explicitly instead of reading it from a React context, and `Reveal` is a
 * client leaf that renders server-rendered children without pulling this
 * module across the boundary.
 *
 * Each section enters in two beats — the rail wakes first, then the content
 * column — which reads as the instrument coming up before the readout appears.
 * The sequence is applied here rather than per section so it cannot drift.
 */

export function sectionHeadingId(id: SectionId): string {
  return `${id}-heading`;
}

type ShellProps = {
  id: SectionId;
  /** Live readout rendered under the label, e.g. "4 repos". */
  readout?: ReactNode;
  /** Band surface. Alternating bands break the page up without nesting cards. */
  tone?: "base" | "surface";
  className?: string;
  children: ReactNode;
};

export function SectionShell({
  id,
  readout,
  tone = "base",
  className,
  children,
}: ShellProps) {
  const meta = sectionMeta(id);

  return (
    <section
      id={id}
      aria-labelledby={sectionHeadingId(id)}
      className={cn(
        "skip-target border-b border-rule",
        tone === "surface" ? "bg-surface" : "bg-background",
        className
      )}
    >
      <div className="mx-auto w-full max-w-shell px-5 sm:px-6 lg:px-8">
        <div className="grid gap-x-12 gap-y-7 py-16 sm:py-20 lg:grid-cols-[9.5rem_minmax(0,1fr)] lg:gap-y-0 lg:py-24">
          <div className="lg:border-r lg:border-rule lg:pr-8">
            <SectionDrift range={14}>
              <Reveal index={0}>
                <div className="flex items-baseline gap-3 lg:flex-col lg:items-start lg:gap-2.5">
                  <span className="numeric label-mono text-brand-strong">
                    {meta.index}
                  </span>
                  <span className="label-mono text-muted-foreground">
                    {meta.label}
                  </span>
                </div>
                {readout ? (
                  <p className="numeric label-mono mt-3 text-muted-foreground lg:mt-5">
                    {readout}
                  </p>
                ) : null}
              </Reveal>
            </SectionDrift>
          </div>
          <Reveal index={1} className="flex min-w-0 flex-col gap-8 lg:gap-10">
            {children}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** One heading scale for every section — fluid so it never wraps badly. */
export function SectionHeading({
  id,
  children,
  className,
}: {
  id: SectionId;
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      id={sectionHeadingId(id)}
      className={cn(
        "headline max-w-[20ch] text-[clamp(1.75rem,4.4vw,2.75rem)] leading-[1.06] text-foreground",
        className
      )}
    >
      {children}
    </h2>
  );
}

/** Supporting line under a section heading. */
export function SectionLede({ children }: { children: ReactNode }) {
  return (
    <p className="prose-body text-base leading-relaxed text-muted-foreground md:text-lg">
      {children}
    </p>
  );
}
