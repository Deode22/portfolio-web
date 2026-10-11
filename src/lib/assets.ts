import {
  assets,
  presentAssetsOfKind,
  type Asset,
} from "@/data/assets.generated";

/**
 * Asset lookup helpers.
 *
 * The manifest is keyed by bare public-relative paths (`images/avatar.jpg`),
 * but callers naturally hold URL-shaped values (`/images/avatar.jpg`) because
 * that is what an `href` or `src` needs. Normalising in one place keeps a
 * leading slash from silently degrading into a placeholder, and keeps anyone
 * from building `//images/avatar.jpg` -- which is a protocol-relative URL and
 * resolves to a *hostname*, not a file.
 */
export function normalizeAssetPath(path: string): string {
  return path.replace(/^\/+/, "");
}

/** Manifest entry for a public-relative or URL-shaped path. */
export function assetAt(path: string): Asset | undefined {
  return assets[normalizeAssetPath(path)];
}

/** True only for a file that exists on disk and actually has bytes. */
export function isAssetUsable(path: string): boolean {
  return assetAt(path)?.status === "present";
}

/** Absolute-from-root URL for a public-relative path. */
export function assetUrl(path: string): string {
  return `/${normalizeAssetPath(path)}`;
}

/**
 * Resolve a preferred path, falling back to any other usable asset of the same
 * kind. This is what makes renaming a file inside public/ a non-event: the CV
 * link keeps working when the PDF is called something else, and the "no usable
 * asset" state stays a deliberate, visible decision rather than a 404.
 */
export function resolveAsset(
  preferredPath: string,
  kind: Asset["kind"]
): Asset | undefined {
  const preferred = assetAt(preferredPath);
  if (preferred?.status === "present") return preferred;
  return presentAssetsOfKind(kind)[0];
}
