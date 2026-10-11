import { ArrowUpRight, Code } from "lucide-react";

import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/utils";
import type { Project } from "@/data/types";

/**
 * Projects render as a ruled index, not a grid of cards. Hairlines on the
 * section background do the separating; the only filled surface is the
 * featured row, which earns it because it is the one the visitor should read
 * first. No nested boxes, and only one image slot — so a missing thumbnail
 * costs one quiet plate instead of four broken ones.
 */

function Stack({ items }: { items: string[] }) {
  return (
    <p className="font-mono text-xs leading-relaxed text-muted-foreground">
      {items.join(" · ")}
    </p>
  );
}

function RepoLink({ project }: { project: Project }) {
  // Entries with nothing public to link to simply omit the row.
  if (!project.repo || !project.repoLabel) return null;
  return (
    <a
      href={project.repo}
      target="_blank"
      rel="noopener noreferrer"
      className="pressable group/repo inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground underline decoration-rule underline-offset-4 transition-colors duration-fast ease-console hover:text-brand-strong hover:decoration-brand-strong focus-visible:text-brand-strong"
    >
      <Code className="size-3.5" aria-hidden />
      {project.repoLabel}
      <ArrowUpRight
        className="size-3.5 transition-transform duration-base ease-console group-hover/repo:-translate-y-0.5 group-hover/repo:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/repo:translate-x-0 motion-reduce:group-hover/repo:-translate-y-0"
        aria-hidden
      />
    </a>
  );
}

export function FeaturedProject({ project }: { project: Project }) {
  return (
    <article className="group grid gap-8 bg-surface px-5 py-7 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-10">
      <div className="flex min-w-0 flex-col gap-4">
        <p className="label-mono text-brand-strong">
          {"// "}
          {project.meta ?? project.id.toUpperCase()}
        </p>
        <h3 className="headline text-[clamp(1.5rem,3.2vw,2rem)] leading-tight text-foreground">
          {project.title}
        </h3>
        <p className="prose-body text-base leading-relaxed text-foreground/90">
          {project.blurb}
        </p>
        <Stack items={project.stack} />
        {project.repo ? (
          <div className="pt-1">
            <RepoLink project={project} />
          </div>
        ) : null}
      </div>
      <div className="relative aspect-[16/10] w-full overflow-hidden border border-rule bg-background">
        <AssetImage
          path={project.thumbnail}
          alt={`${project.title} preview`}
          fill
          sizes="(max-width: 1024px) 100vw, 20rem"
          className="bg-background transition-transform duration-slow ease-console group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:scale-100"
        />
      </div>
    </article>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col gap-3.5 px-5 py-7 transition-colors duration-base ease-console",
        "hover:bg-surface"
      )}
    >
      {/* Oxide rule marking the row under the pointer: the index equivalent of
          the press feedback the buttons already give. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px origin-top scale-y-0 bg-brand-strong transition-transform duration-base ease-console group-hover:scale-y-100 motion-reduce:transition-none motion-reduce:scale-y-100"
      />
      <p className="label-mono text-brand-strong">
        {"// "}
        {project.meta ?? project.id.toUpperCase()}
      </p>
      <h3 className="headline text-xl leading-tight text-foreground transition-transform duration-base ease-console group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:translate-x-0">
        {project.title}
      </h3>
      <p className="text-sm leading-relaxed text-foreground/85">
        {project.blurb}
      </p>
      <div className="mt-auto flex flex-col gap-3 pt-1">
        <Stack items={project.stack} />
        <RepoLink project={project} />
      </div>
    </article>
  );
}
