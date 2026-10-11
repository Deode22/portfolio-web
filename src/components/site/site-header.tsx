"use client";

import { useEffect, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { Code, Briefcase } from "lucide-react";

import { siteCopy } from "@/data/profile";
import { sections } from "@/data/sections";
import { cn } from "@/lib/utils";

/**
 * Sticky console header. The section indices are not decoration: they match
 * the per-section rail, and the nav tracks which section owns the viewport so
 * the index doubles as a position readout.
 */
export function SiteHeader() {
  const [activeId, setActiveId] = useState<string>(sections[0].id);
  const { scrollY } = useScroll();

  /**
   * The active index is derived from scroll position, so it reads Motion's
   * scroll value instead of subscribing to `scroll` directly. A raw scroll
   * listener runs on every frame of the gesture; `useScroll` batches to its own
   * frame loop and hands us the position already, which is also the value the
   * rest of the page animates from. `resize` is still needed on its own because
   * the viewport line below is measured in pixels.
   */
  useEffect(() => {
    const compute = () => {
      const line = window.innerHeight * 0.28;
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top - line <= 0) current = s.id;
      }
      const atBottom =
        window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
      if (atBottom) current = sections[sections.length - 1].id;
      setActiveId(current);
    };

    const initial = requestAnimationFrame(compute);
    window.addEventListener("resize", compute);

    return () => {
      cancelAnimationFrame(initial);
      window.removeEventListener("resize", compute);
    };
  }, []);

  useMotionValueEvent(scrollY, "change", () => {
    const line = window.innerHeight * 0.28;
    let current = sections[0].id;
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el && el.getBoundingClientRect().top - line <= 0) current = s.id;
    }
    const atBottom =
      window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
    if (atBottom) current = sections[sections.length - 1].id;
    setActiveId(current);
  });

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-rule bg-background">
        <div className="mx-auto flex h-12 w-full max-w-shell items-center gap-6 px-5 sm:px-6 lg:px-8">
          <a
            href="#hero"
            className="label-mono pressable shrink-0 text-foreground transition-colors duration-fast ease-console hover:text-brand-strong focus-visible:text-brand-strong"
          >
            DFV<span className="text-brand-strong">.field</span>
          </a>

          <nav className="ml-auto hidden lg:block" aria-label="Sections">
            <ul className="flex items-center gap-5">
              {sections.map((s) => {
                const isActive = activeId === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "label-mono pressable flex items-baseline gap-1.5 border-b py-1 transition-colors duration-fast ease-console",
                        isActive
                          ? "border-brand-strong text-foreground"
                          : "border-transparent text-muted-foreground hover:border-rule hover:text-foreground"
                      )}
                    >
                      <span className="numeric text-brand-strong">
                        {s.index}
                      </span>
                      {s.navLabel}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <nav className="ml-auto flex items-center gap-1 lg:ml-0" aria-label="Social">
            <a
              href={siteCopy.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub profile"
              className="pressable rounded-sm p-1.5 text-muted-foreground transition-colors duration-fast ease-console hover:bg-accent hover:text-foreground focus-visible:text-foreground"
            >
              <Code className="size-4" aria-hidden />
            </a>
            <a
              href={siteCopy.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn profile"
              className="pressable rounded-sm p-1.5 text-muted-foreground transition-colors duration-fast ease-console hover:bg-accent hover:text-foreground focus-visible:text-foreground"
            >
              <Briefcase className="size-4" aria-hidden />
            </a>
          </nav>
        </div>
      </header>

      {/* Below `lg` the section index becomes its own scrollable strip rather
          than a second overlay. */}
      <nav
        className="sticky top-12 z-30 border-b border-rule bg-background lg:hidden"
        aria-label="Sections"
      >
        <ul className="mx-auto flex w-full max-w-shell items-center gap-1 overflow-x-auto px-5 py-1.5 sm:px-6 lg:px-8">
          {sections.map((s) => {
            const isActive = activeId === s.id;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "label-mono pressable flex items-baseline gap-1.5 whitespace-nowrap border-b px-1.5 py-1.5 transition-colors duration-fast ease-console",
                    isActive
                      ? "border-brand-strong text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="numeric text-brand-strong">{s.index}</span>
                  {s.navLabel}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
