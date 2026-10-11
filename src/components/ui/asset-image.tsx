import NextImage from "next/image";

import { cn } from "@/lib/utils";
import { assetAt, assetUrl, normalizeAssetPath } from "@/lib/assets";

type Props = {
  /** Path under public/, with or without a leading slash. */
  path: string;
  alt: string;
  className?: string;
  /** When true, renders inside a relative container with `fill`. */
  fill?: boolean;
  /** Preload above-the-fold images (replaces the deprecated `priority`). */
  preload?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
};

/**
 * Renders the file if `scripts/sync-assets.mjs` found it, otherwise a ruled
 * plate that reads as part of the console rather than as a broken slot. No
 * dashed borders: dashes are error chrome, and four of them stacked in the
 * project index was the loudest thing on the page.
 *
 * `path` is accepted with or without a leading slash. The manifest is keyed
 * by bare public-relative paths (`images/avatar.jpg`), but callers reasonably
 * pass URL-shaped values (`/images/avatar.jpg`) because that is what an `href`
 * needs. Normalising here means one convention can't silently fall through to
 * the placeholder — and it keeps `src` from becoming the protocol-relative
 * `//images/avatar.jpg`, which resolves to a *hostname*, not a file.
 */
export function AssetImage({
  path,
  alt,
  className,
  fill = false,
  preload = false,
  sizes = "(max-width: 768px) 100vw, 33vw",
  width = 800,
  height = 600,
}: Props) {
  const key = normalizeAssetPath(path);
  const isPresent = assetAt(key)?.status === "present";
  const src = assetUrl(key);

  if (isPresent) {
    if (fill) {
      return (
        <div className={cn("relative h-full w-full overflow-hidden", className)}>
          <NextImage
            src={src}
            alt={alt}
            fill
            preload={preload}
            sizes={sizes}
            className="object-cover"
          />
        </div>
      );
    }
    return (
      <NextImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        preload={preload}
        sizes={sizes}
        className={className}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`No preview available for ${alt}`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, color-mix(in oklab, var(--rule) 55%, transparent) 0 1px, transparent 1px 7px)",
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 bg-surface p-4 text-center text-muted-foreground",
        fill ? "absolute inset-0" : "",
        className
      )}
    >
      <span className="label-mono">{"// no preview"}</span>
      <span className="font-mono text-[10px] leading-tight tracking-wide break-all opacity-70">
        {key}
      </span>
    </div>
  );
}
