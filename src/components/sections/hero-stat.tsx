"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

import { cn } from "@/lib/utils";
import type { Stat } from "@/data/types";

type Props = {
  stat: Stat;
  className?: string;
};

/**
 * Locale and digits are pinned: the server and the browser have to agree on the
 * very first painted frame, and `en-US` grouping is the one the rest of the
 * instrument readouts already assume.
 */
const formatter = new Intl.NumberFormat("en-US");

/**
 * The hero figures count up once, when the instrument first scrolls into view.
 *
 * Two constraints shaped this:
 *
 * - The motion value always starts at 0, on the server as well as the client.
 *   Seeding it from `useReducedMotion()` looked harmless but broke hydration:
 *   `matchMedia` does not exist on the server, so a reduced-motion visitor was
 *   served `0` in the HTML and then hydrated against `3,000`, and React threw
 *   away the subtree. Reduced motion is now handled by collapsing the spring
 *   instead of by choosing a different starting number, which keeps the first
 *   frame identical for everyone.
 * - The formatted number is a Motion transform, so Motion writes the digits
 *   into the DOM directly. Holding them in React state re-rendered this whole
 *   subtree on every frame of the count-up.
 * - The count-up is an explicit tween rather than a spring. A spring built from
 *   `duration`/`bounce` settled inside a single frame here, so the figure just
 *   snapped to its final value and the count-up was never visible. A tween with
 *   an explicit duration is unambiguous, and `--ease-console` is the curve the
 *   rest of the page already moves on.
 */
export function StatCounter({ stat, className }: Props) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (v) => formatter.format(Math.round(v)));

  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      motionValue.set(stat.value);
      return;
    }
    const controls = animate(motionValue, stat.value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [inView, motionValue, reduce, stat.value]);

  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-2 py-6 sm:px-6 sm:first:pl-0 sm:last:pr-0", className)}
    >
      <dt className="label-mono text-brand-strong">{stat.meta}</dt>
      <dd className="flex flex-col gap-2">
        <span className="flex items-baseline gap-1.5">
          {stat.prefix ? (
            <span className="font-mono text-sm text-muted-foreground">
              {stat.prefix}
            </span>
          ) : null}
          <motion.span className="numeric headline text-[2.25rem] leading-none text-foreground md:text-[2.75rem]">
            {display}
          </motion.span>
          {stat.suffix ? (
            <span className="numeric font-mono text-base text-muted-foreground">
              {stat.suffix}
            </span>
          ) : null}
        </span>
        <span className="text-sm leading-snug text-foreground">{stat.label}</span>
        <span className="font-mono text-xs leading-snug text-muted-foreground">
          {stat.footnote}
        </span>
      </dd>
    </div>
  );
}
