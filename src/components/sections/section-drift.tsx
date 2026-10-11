"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

/**
 * Scroll-linked drift for a decorative layer.
 *
 * This is the one piece of scroll motion on the page, and it deliberately does
 * not touch the reading position. An earlier version settled the viewport onto
 * the nearest section heading after scrolling stopped; it worked, measured
 * correct, and still made the page feel like it was taking the camera away from
 * the reader — a 300–400px pan nobody asked for, arriving after they had
 * already let go. Motion that relocates the viewport is a correction, and
 * corrections read as lag or as motion sickness, not as polish.
 *
 * Drift keeps the camera exactly where the reader parked it and moves a layer
 * *inside* the frame by a few pixels instead, so the page gains depth without
 * ever changing what is being read. The rail is the right layer for it: it is
 * the slowest-moving thing in the layout already, it is structurally redundant
 * with the section heading, and nothing depends on it being pixel-accurate.
 *
 * Two rules keep it honest:
 *
 * - The bounds are measured once into a MotionValue, so the per-frame work is
 *   arithmetic only. Calling `getBoundingClientRect()` inside the transform
 *   would force a layout on every scroll frame — the classic way a parallax
 *   effect turns into a stutter. Keeping the bounds in a MotionValue (rather
 *   than a ref read at render time) also means a refresh that lands mid-page
 *   recomputes immediately instead of sitting at the pre-measurement value
 *   until the first scroll.
 * - `transform` only, and nothing under `prefers-reduced-motion`. Position
 *   animation is exactly what that preference is about.
 */

type SectionDriftProps = {
  children: ReactNode;
  className?: string;
  /**
   * Total travel in px, spread across the element's whole pass through the
   * viewport. Positive drifts downward, so the layer lags the scroll and reads
   * as slower than the page rather than sliding against it.
   */
  range?: number;
};

export function SectionDrift({
  children,
  className,
  range = 14,
}: SectionDriftProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();

  /** Scroll positions at which the layer enters and leaves the viewport. */
  const startAt = useMotionValue(0);
  const endAt = useMotionValue(1);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    startAt.set(top - window.innerHeight);
    endAt.set(top + rect.height);
  }, [endAt, startAt]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    // Web fonts and the reveal animations both change this layer's height after
    // mount, so a resize-only measure would leave the drift keyed to stale
    // bounds until the next window resize.
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [measure]);

  const drift = useTransform(
    [scrollY, startAt, endAt],
    ([latest, start, end]: number[]) => {
      if (end <= start) return 0;
      const progress = Math.min(Math.max((latest - start) / (end - start), 0), 1);
      return progress * range;
    }
  );

  return (
    <motion.div ref={ref} className={className} style={{ y: reduce ? 0 : drift }}>
      {children}
    </motion.div>
  );
}