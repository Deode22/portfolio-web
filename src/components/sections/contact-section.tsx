import { ArrowUpRight, Briefcase, Code, Mail, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { contactEmail, contactIntro, siteCopy } from "@/data/profile";
import {
  SectionHeading,
  SectionLede,
  SectionShell,
} from "@/components/sections/section-shell";

export function ContactSection() {
  return (
    <>
      <SectionShell
        id="contact"
        readout={siteCopy.locationShort}
        tone="surface"
        className="border-b-0"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="flex flex-col gap-5">
            <SectionHeading id="contact" className="max-w-[16ch]">
              Bring a project, or a dataset.
            </SectionHeading>
            <SectionLede>{contactIntro}</SectionLede>
          </div>

          {/* One unambiguous primary action. Which one it is depends on
              whether a real address is configured — never both, never neither. */}
          <div className="flex shrink-0 flex-wrap gap-3">
            {contactEmail ? (
              <Button size="lg" asChild>
                <a href={`mailto:${contactEmail}`}>
                  <Mail data-icon="inline-start" />
                  Email me
                </a>
              </Button>
            ) : (
              <Button size="lg" asChild>
                <a
                  href={siteCopy.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Briefcase data-icon="inline-start" />
                  Connect on LinkedIn
                  <ArrowUpRight data-icon="inline-end" />
                </a>
              </Button>
            )}
            <Button variant="outline" size="lg" asChild>
              <a href={siteCopy.github} target="_blank" rel="noopener noreferrer">
                <Code data-icon="inline-start" />
                GitHub
              </a>
            </Button>
          </div>
        </div>

        <dl className="grid gap-px border border-rule bg-rule sm:grid-cols-2">
          {contactEmail ? (
            <ContactCell icon={Mail} label="Email" value={contactEmail} mono />
          ) : null}
          <ContactCell
            icon={Code}
            label="GitHub"
            value={siteCopy.github.replace("https://", "")}
            href={siteCopy.github}
          />
          <ContactCell
            icon={Briefcase}
            label="LinkedIn"
            value={siteCopy.linkedin.replace(
              "https://www.linkedin.com/in/",
              "/in/"
            )}
            href={siteCopy.linkedin}
          />
          <ContactCell
            icon={MapPin}
            label="Based in"
            value={siteCopy.location}
          />
        </dl>
      </SectionShell>

      <footer className="border-t border-rule bg-surface">
        <div className="mx-auto flex w-full max-w-shell flex-col gap-2 px-5 py-7 font-mono text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span className="numeric">
            <span className="text-brand-strong">©</span>{" "}
            {new Date().getFullYear()} {siteCopy.name}
          </span>
          <span>
            Built on{" "}
            <span className="text-foreground">Next.js 16</span> ·{" "}
            <span className="text-foreground">Tailwind v4</span> ·{" "}
            <span className="text-foreground">shadcn/ui new-york</span>
          </span>
        </div>
      </footer>
    </>
  );
}

function ContactCell({
  icon: Icon,
  label,
  value,
  href,
  mono = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 bg-surface px-5 py-4">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="label-mono text-muted-foreground">{label}</dt>
        <dd className="min-w-0">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-block max-w-full truncate text-sm text-foreground underline decoration-rule underline-offset-4 transition-colors duration-fast ease-console hover:text-brand-strong hover:decoration-brand-strong focus-visible:text-brand-strong",
                mono && "font-mono"
              )}
            >
              {value}
            </a>
          ) : (
            <span className="text-sm text-foreground">{value}</span>
          )}
        </dd>
      </div>
    </div>
  );
}
