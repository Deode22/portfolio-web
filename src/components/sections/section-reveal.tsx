"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Section entry motion. The page already has two authored moments — the hero
 * instrument counters and the pipeline trace — but every other section entered
 * the viewport fully formed. These give the remaining sections the same
 * restrained entrance so the reveal reads as one system rather than a one-off.
 *
 * Every constraint here is deliberate:
 *
 * - `transform` (y) and `opacity` only. Nothing animates layout, so entering a
 *   section can never shift the page under the reader's cursor.
 * - Under `prefers-reduced-motion` the initial frame is the final frame, so the
 *   section is simply present. The global block in globals.css only neutralizes
 *   CSS transitions; motion/react drives values from JS, so each piece has to
 *   opt out on its own.
 * - `once: true`. A section that has been read stays read — re-animating on
 *   every scroll pass makes the page feel like it keeps resetting.
 * - Delays are computed per item from `index` rather than driven by Motion
 *   `variants`/`staggerChildren`. Sequencing then does not depend on parent and
 *   child sharing one client tree, which keeps `SectionShell` a server
 *   component wrapping a single client leaf.
 * - Entrances are deliberately slow (0.7s, 130ms apart) while pointer feedback
 *   elsewhere on the page stays at 120–180ms. A section arriving on screen is a
 *   change of context and wants to be readable as it happens; a hover is a
 *   direct response to the hand and feels broken if it lags. Sections now also
 *   settle under scroll snap, which adds travel the reader has to wait out, so
 *   the entrance is not competing with motion they did not start.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const DURATION = 0.7;

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Position in the entrance sequence. Drives the stagger. */
  index?: number;
  /** Seconds between adjacent items. */
  step?: number;
  /** Travel distance in px. Set to 0 for a fade with no lift. */
  distance?: number;
};

export function Reveal({
  children,
  className,
  index = 0,
  step = 0.13,
  distance = 14,
}: RevealProps) {
  const reduce = useReducedMotion();
  /**
   * The rail is short and the content column is tall, so a fixed stagger would
   * let the column start before the rail has finished. Scaling the delay with
   * travel distance keeps the instrument waking up ahead of the readout that
   * depends on it.
   */
  const delay = reduce ? 0 : index * step + (distance > 0 ? index * 0.02 : 0);

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -10% 0px" }}
      transition={{
        duration: reduce ? 0 : DURATION,
        delay,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}