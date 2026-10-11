import { Suspense } from "react";
import { ArrowDownToLine, ArrowUpRight, Code, Briefcase } from "lucide-react";

import { siteCopy } from "@/data/profile";
import { sectionMeta } from "@/data/sections";
import { stats } from "@/data/stats";
import { assetUrl, resolveAsset } from "@/lib/assets";
import { Button } from "@/components/ui/button";
import { AssetImage } from "@/components/ui/asset-image";
import { StatCounter } from "@/components/sections/hero-stat";

export function HeroSection() {
  const meta = sectionMeta("hero");
  /**
   * Resolved by preferred filename, then by kind. A zero-byte PDF does not
   * count, so an empty placeholder file can never put a live download link on
   * the page, and renaming the file inside public/ does not require a code
   * change.
   */
  const cv = resolveAsset(siteCopy.cvPath, "pdf");
  const [firstName, ...rest] = siteCopy.name.split(" ");

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="skip-target relative isolate overflow-hidden border-b border-rule bg-background"
    >
      {/* The page's one authored ambient moment: light bleeding off the top
          edge of the console face, over a hairline column grid. */}
      <div aria-hidden className="phosphor-bleed absolute inset-0 -z-10" />
      <div aria-hidden className="rule-grid absolute inset-0 -z-10 opacity-45" />

      <div className="mx-auto w-full max-w-shell px-5 sm:px-6 lg:px-8">
        {/* Console status bar — the hero's counterpart to the section rail. */}
        <div className="flex items-center gap-4 border-b border-rule py-4">
          <span className="numeric label-mono text-brand-strong">
            {meta.index}
          </span>
          <span className="label-mono text-muted-foreground">{meta.label}</span>
          <span aria-hidden className="h-px flex-1 bg-rule" />
          <span className="label-mono text-muted-foreground">
            {siteCopy.locationShort}
          </span>
        </div>

        <div className="grid gap-x-12 gap-y-10 pb-14 pt-12 sm:pb-16 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-y-0 lg:pb-20 lg:pt-20">
          <div className="flex min-w-0 flex-col">
            <h1
              id="hero-heading"
              className="headline text-[clamp(2.75rem,9.5vw,6rem)] leading-[0.92] text-foreground"
            >
              {firstName}
              <br />
              <span className="text-brand-strong">{rest.join(" ")}</span>
            </h1>

            <p className="mt-7 max-w-[26ch] font-heading text-lg leading-snug text-foreground whitespace-pre-line md:text-xl">
              {siteCopy.title}
            </p>

            <p className="prose-body mt-5 text-lg leading-relaxed text-foreground/90 md:text-xl">
              {siteCopy.valueProp}.
            </p>

            <p className="prose-body mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              {siteCopy.description}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-3">
              <Button asChild size="lg">
                <a href={siteCopy.github} target="_blank" rel="noopener noreferrer">
                  <Code data-icon="inline-start" />
                  GitHub
                  <ArrowUpRight data-icon="inline-end" />
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a
                  href={siteCopy.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Briefcase data-icon="inline-start" />
                  LinkedIn
                </a>
              </Button>
              {cv ? (
                <Button variant="ghost" size="lg" asChild>
                  <a href={assetUrl(cv.path)} target="_blank" rel="noopener noreferrer">
                    <ArrowDownToLine data-icon="inline-start" />
                    Download CV
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          {/* Portrait plate. The image slot carries the only real photography
              on the page, so it gets a lifted surface and a hairline edge. */}
          <div className="lg:justify-self-end">
            <div className="relative aspect-[4/5] w-full max-w-[15rem] overflow-hidden border border-rule bg-surface lg:w-[15rem]">
              <AssetImage
                path={siteCopy.avatarPath}
                alt={`${siteCopy.name}, ${siteCopy.title}`}
                fill
                preload
                sizes="(max-width: 1024px) 15rem, 15rem"
                className="bg-surface"
              />
            </div>
            <p className="numeric label-mono mt-3 text-muted-foreground">
              {siteCopy.coordinates}
            </p>
          </div>
        </div>

        {/* Instrument readout — three figures on one shared hairline, sized to
            read as evidence rather than as headline decoration. */}
        <Suspense>
          <div className="border-t border-rule">
            <dl className="grid grid-cols-1 sm:grid-cols-3">
              {stats.map((s, i) => (
                <StatCounter
                  key={s.id}
                  stat={s}
                  className={
                    i > 0
                      ? "border-t border-rule sm:border-t-0 sm:border-l"
                      : undefined
                  }
                />
              ))}
            </dl>
          </div>
        </Suspense>
      </div>
    </section>
  );
}
