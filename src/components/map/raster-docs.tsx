"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { rasterDocsFor } from "@/data/raster-docs";
import { cn } from "@/lib/utils";

/**
 * Methodology + processing snippet for a documented map layer, rendered as
 * collapsible accordions below the map. Copy lives in
 * src/data/raster-docs.ts; this component only renders it (Earth Engine JS,
 * Python, whichever the layer's docs declare). Layers without docs render
 * nothing.
 */
export function RasterDocs({ layerId }: { layerId: string }) {
  const docs = rasterDocsFor(layerId);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  // Clear the pending "copied" reset when the layer (and so this subtree)
  // swaps out, so the timer cannot fire against an unmounted tree.
  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  if (!docs) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(docs.snippet);
      setCopied(true);
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context / permission denied): the
      // snippet stays selectable in the block below.
    }
  };

  const lines = docs.snippet.split("\n");

  return (
    <div className="border border-rule bg-background p-4">
      <span className="label-mono text-brand-strong">{"// methodology"}</span>
      <Accordion type="multiple" className="mt-2">
        <AccordionItem value="methodology">
          <AccordionTrigger className="py-2 font-mono text-xs uppercase tracking-wide text-muted-foreground hover:no-underline hover:text-foreground">
            how it was computed
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <div className="flex flex-col gap-2">
              {docs.methodology.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="font-mono text-xs leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="code-snippet" className="border-b-0">
          <AccordionTrigger className="py-2 font-mono text-xs uppercase tracking-wide text-muted-foreground hover:no-underline hover:text-foreground">
            {docs.snippetTitle}
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <div className="flex items-center justify-between gap-2 border border-rule border-b-0 bg-surface px-2 py-1.5">
              <span className="label-mono text-muted-foreground">
                {docs.snippetLabel}
              </span>
              <button
                type="button"
                onClick={() => void handleCopy()}
                aria-label={copied ? "Code copied" : "Copy code"}
                className={cn(
                  "flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-wide transition-colors duration-fast ease-console",
                  "text-muted-foreground hover:text-foreground focus-visible:text-brand-strong focus-visible:outline-none",
                  copied && "text-brand-strong"
                )}
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
                <span>{copied ? "copied" : "copy"}</span>
              </button>
            </div>
            {/**
              Comment lines (`// …` in JS, `# …` in Python) are dimmed, the
              rest stays readable — enough structure to scan without pulling
              in a highlighter. Non-breaking spaces keep blank lines from
              collapsing.
            */}
            <pre className="max-h-64 overflow-auto border border-rule bg-background p-3 font-mono text-[0.625rem] leading-relaxed">
              <code>
                {lines.map((line, i) => (
                  <span
                    key={`${i}-${line.slice(0, 8)}`}
                    className={cn(
                      "block whitespace-pre",
                      (line.trimStart().startsWith("//") ||
                        line.trimStart().startsWith("#")) &&
                        "text-muted-foreground"
                    )}
                  >
                    {line === "" ? "\u00a0" : line}
                  </span>
                ))}
              </code>
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
