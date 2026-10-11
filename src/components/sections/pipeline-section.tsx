"use client";

import { useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";

import { pipelineIntro, pipelineNodes } from "@/data/pipeline";
import { cn } from "@/lib/utils";
import {
  SectionHeading,
  SectionLede,
  SectionShell,
} from "@/components/sections/section-shell";

/**
 * The pipeline is a horizontal flow on desktop and a vertical stack on mobile.
 * The connector line draws itself into view via `pathLength` when the section
 * enters the viewport — the page's second and last authored moment — and
 * clicking a node surfaces its detail plate.
 *
 * Stays driven by src/data/pipeline.ts — never hard-codes tool / label text.
 */
export function PipelineSection() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(wrapRef, { once: true, margin: "0px 0px -10% 0px" });

  const [activeId, setActiveId] = useState<(typeof pipelineNodes)[number]["id"] | null>(
    null
  );
  const active = useMemo(
    () => (activeId ? pipelineNodes.find((n) => n.id === activeId) ?? null : null),
    [activeId]
  );

  return (
    <SectionShell id="pipeline" readout={`${pipelineNodes.length} stages`} tone="surface">
      <div ref={wrapRef} className="flex flex-col gap-8 lg:gap-10">
        <SectionHeading id="pipeline">From satellite pass to dashboard.</SectionHeading>
        <SectionLede>{pipelineIntro}</SectionLede>

        {/* Desktop / wide: horizontal trace with five nodes */}
        <div className="hidden md:block">
          <svg
            viewBox="0 0 1000 96"
            role="img"
            aria-label={`${pipelineNodes.length}-stage geospatial pipeline from raw data to visualization`}
            className="h-20 w-full"
          >
            <line
              x1={40}
              y1={40}
              x2={960}
              y2={40}
              stroke="var(--rule)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <motion.line
              x1={40}
              y1={40}
              x2={960}
              y2={40}
              stroke="var(--brand-strong)"
              strokeWidth={2}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: inView || reduce ? 1 : 0 }}
              transition={{
                duration: reduce ? 0 : 0.9,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
            {pipelineNodes.map((n, i) => {
              const x = 40 + i * (920 / (pipelineNodes.length - 1));
              const isActive = activeId === n.id;
              return (
                <g key={n.id}>
                  <circle
                    cx={x}
                    cy={40}
                    r={isActive ? 9 : 6}
                    fill={isActive ? "var(--brand-strong)" : "var(--surface)"}
                    stroke="var(--brand-strong)"
                    strokeWidth={2}
                  />
                </g>
              );
            })}
          </svg>

          <ul className="grid grid-cols-5 gap-px border-t border-rule bg-rule">
            {pipelineNodes.map((n) => (
              <li key={n.id} className="bg-surface">
                <StageButton
                  index={n.index}
                  label={n.label}
                  tool={n.tool}
                  isActive={activeId === n.id}
                  showBar
                  onToggle={() =>
                    setActiveId(activeId === n.id ? null : n.id)
                  }
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Mobile: vertical timeline — same content, one column. */}
        <ol className="relative flex flex-col gap-4 pl-6 md:hidden">
          <span
            aria-hidden
            className="absolute left-[3px] top-2 bottom-2 w-px bg-rule"
          />
          {pipelineNodes.map((n) => (
            <li key={n.id} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -left-6 top-4 size-[7px] rounded-full border",
                  activeId === n.id
                    ? "border-brand-strong bg-brand-strong"
                    : "border-brand-strong bg-surface"
                )}
              />
              <StageButton
                index={n.index}
                label={n.label}
                tool={n.tool}
                isActive={activeId === n.id}
                onToggle={() => setActiveId(activeId === n.id ? null : n.id)}
              />
            </li>
          ))}
        </ol>

        <Readout active={active} />
      </div>
    </SectionShell>
  );
}

function StageButton({
  index,
  label,
  tool,
  isActive,
  showBar = false,
  onToggle,
}: {
  index: string;
  label: string;
  tool: string;
  isActive: boolean;
  /** Desktop only: a 2px oxide rule marks the active column. */
  showBar?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isActive}
      aria-controls="pipeline-readout"
      className={cn(
        "pressable relative flex h-full w-full flex-col items-start gap-1.5 p-4 text-left transition-colors duration-base ease-console",
        isActive ? "bg-background" : "hover:bg-background",
        showBar &&
          isActive &&
          "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-brand-strong"
      )}
    >
      <span className="numeric label-mono text-brand-strong">{index}</span>
      <span className="font-heading text-sm leading-snug text-foreground">
        {label}
      </span>
      <span className="font-mono text-[11px] leading-snug text-muted-foreground">
        {tool}
      </span>
    </button>
  );
}

function Readout({
  active,
}: {
  active: (typeof pipelineNodes)[number] | null;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      id="pipeline-readout"
      aria-live="polite"
      className="border border-rule bg-background"
    >
      {/* Header is permanent so the plate never reads as an empty card. */}
      <div className="flex items-center justify-between gap-4 border-b border-rule px-4 py-2.5 sm:px-5">
        <span className="label-mono text-brand-strong">{"// readout"}</span>
        <span className="numeric label-mono text-muted-foreground">
          {active ? `stage ${active.index}` : "idle"}
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {active ? (
          <motion.div
            key={active.id}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-3 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-heading text-xl leading-tight text-foreground">
                {active.label}
              </h3>
              <p className="font-mono text-sm text-brand-strong">
                {active.tool}
              </p>
            </div>
            <p className="prose-body text-sm leading-relaxed text-foreground/90">
              {active.detail}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {"// e.g. "}
              {active.example}
            </p>
          </motion.div>
        ) : (
          <motion.p
            key="idle"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.12 }}
            className="px-4 py-5 font-mono text-xs text-muted-foreground sm:px-5"
          >
            Select a stage to read its tooling and a concrete output.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
