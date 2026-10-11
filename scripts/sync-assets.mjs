#!/usr/bin/env node
/**
 * sync-assets.mjs
 *
 * Scans public/ and writes src/data/assets.generated.ts with a presence map so
 * the UI can show a hairline-bordered placeholder for unusable files instead
 * of a broken <Image /> or a dead download link. Wired into predev / prebuild.
 *
 * Two rules this script exists to enforce:
 *
 *  1. Existence is not presence. A zero-byte file passes `existsSync`, so a
 *     stub left by a failed download or a bad shell redirect used to be
 *     reported as `present` -- which put a live "Download CV" link on the page
 *     serving an empty PDF and made `next/image` answer 400 for every project
 *     thumbnail. Empty is its own status.
 *
 *  2. The manifest is derived from disk, not from a hand-kept list. Anything
 *     found under the scanned directories is indexed whether or not it was
 *     declared here, so renaming a file in public/ cannot make it invisible.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const publicDir = join(projectRoot, "public");
const dataDir = join(projectRoot, "src", "data");
const outFile = join(dataDir, "assets.generated.ts");

/**
 * Copy vendor worker files that MapLibre GL v6 needs but cannot bundle
 * itself in a Turbopack/Next environment (no Vite `?url` import). The
 * worker imports `./maplibre-gl-shared.mjs` relatively, so we copy the
 * entire prebuilt dist directory into public/.
 */
function copyVendorWorkers() {
  const distSrc = join(projectRoot, "node_modules", "maplibre-gl", "dist");
  const distDest = join(publicDir, "maplibre");
  if (!existsSync(distSrc)) {
    console.info("[sync-assets] maplibre-gl dist not found, skipping copy");
    return;
  }
  mkdirSync(distDest, { recursive: true });
  // Only the bits the worker actually needs: the worker itself and its
  // shared chunk. We deliberately don't ship the dev/source-CSS variants
  // or sourcemaps to keep public/lean.
  const keep = new Set(["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]);
  // Remove stale files we no longer ship.
  for (const name of readdirSync(distDest)) {
    if (!keep.has(name)) rmSync(join(distDest, name), { force: true });
  }
  let count = 0;
  for (const name of readdirSync(distSrc)) {
    if (!keep.has(name)) continue;
    const src = join(distSrc, name);
    const dest = join(distDest, name);
    copyFileSync(src, dest);
    count++;
  }
  console.info(
    `[sync-assets] copied ${count} maplibre vendor files -> ${relative(projectRoot, distDest)}`
  );
}

copyVendorWorkers();

/**
 * Expected assets: the canonical list, used for labels and ordering. It is
 * NOT the source of truth for what exists -- see rule 2 in the header.
 */
const expectedAssets = [
  // Documents
  { path: "documents/Daniel_Fernandez_CV.pdf", kind: "pdf", label: "CV" },

  // Images / OG
  { path: "images/avatar.jpg", kind: "image", label: "Avatar" },
  { path: "images/og-image.png", kind: "image", label: "OG card" },

  // Project previews
  { path: "projects/rusle-cli.png", kind: "image", label: "rusle-cli preview" },
  { path: "projects/extractor-aemet.png", kind: "image", label: "extractor_aemet preview" },
  { path: "projects/prophet-predicting.png", kind: "image", label: "Prophet-Predicting preview" },
  { path: "projects/plantation-field-modelling.png", kind: "image", label: "UPM LiDAR Digital Twin" },

  // GeoJSON (mocked, see public/geojson/README.md).
  // The raster tabs are not here: they read public/rasters/*.png, baked from
  // the source GeoTIFFs by scripts/build-{rusle,hydric,disturbance,lidar}-raster.mjs.
  { path: "geojson/lidar-canopy-metrics.geojson", kind: "geojson", label: "PNOA LiDAR canopy stands" },
];

/**
 * Directories scanned for real files. Anything outside these (the
 * Create-Next-App boilerplate svgs at the public root, the vendored MapLibre
 * worker mirror) is deliberately not indexed: those are not page assets.
 */
const SCAN_DIRS = ["documents", "images", "projects", "geojson"];

const KIND_BY_EXT = new Map([
  [".pdf", "pdf"],
  [".png", "image"],
  [".jpg", "image"],
  [".jpeg", "image"],
  [".webp", "image"],
  [".avif", "image"],
  [".gif", "image"],
  [".svg", "image"],
  [".geojson", "geojson"],
  [".json", "geojson"],
]);

function classify(absPath) {
  if (!existsSync(absPath)) return { status: "missing", bytes: 0 };
  const s = statSync(absPath);
  if (s.isDirectory()) return { status: "directory", bytes: 0 };
  // See rule 1 in the header: 0 bytes is "empty", never "present".
  return { status: s.size === 0 ? "empty" : "present", bytes: s.size };
}

/** Recursively collect every indexable file under the scanned directories. */
function discoverFiles() {
  const found = [];
  const walk = (dirAbs, prefix) => {
    let entries;
    try {
      entries = readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(dirAbs, entry.name), rel);
      } else if (entry.isFile()) {
        found.push(rel);
      }
    }
  };
  for (const dir of SCAN_DIRS) walk(join(publicDir, dir), dir);
  return found;
}

function inferKind(relPath) {
  const dot = relPath.lastIndexOf(".");
  if (dot === -1) return null;
  return KIND_BY_EXT.get(relPath.slice(dot).toLowerCase()) ?? null;
}

function inferLabel(relPath) {
  const base = relPath.split("/").pop() ?? relPath;
  return base
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const declared = new Set(expectedAssets.map((a) => a.path));
const records = [];

// Canonical entries first, so the generated file keeps a stable readable order.
for (const asset of expectedAssets) {
  const { status, bytes } = classify(join(publicDir, asset.path));
  records.push({
    path: asset.path,
    kind: asset.kind,
    label: asset.label,
    status,
    bytes,
  });
}

// Then anything else that is really there. This is what stops a renamed or
// newly added file from being silently dropped from the manifest.
for (const relPath of discoverFiles().sort()) {
  if (declared.has(relPath)) continue;
  const kind = inferKind(relPath);
  if (!kind) continue;
  const { status, bytes } = classify(join(publicDir, relPath));
  records.push({
    path: relPath,
    kind,
    label: inferLabel(relPath),
    status,
    bytes,
  });
}

const tsBody = [
  "/**",
  " * AUTO-GENERATED by scripts/sync-assets.mjs -- do not edit by hand.",
  " * Re-run `node scripts/sync-assets.mjs` or `npm run assets:sync` after",
  " * adding/removing files under public/.",
  " */",
  "",
  'export type AssetStatus = "present" | "empty" | "missing" | "directory";',
  "",
  "export type Asset = {",
  "  path: string;",
  '  kind: "image" | "pdf" | "geojson";',
  "  label: string;",
  "  status: AssetStatus;",
  "  /** Size on disk in bytes. Always 0 unless status is \"present\". */",
  "  bytes: number;",
  "};",
  "",
  "const manifest: ReadonlyArray<Asset> = " +
    JSON.stringify(records, null, 2)
      .replace(/"path"/g, "path")
      .replace(/"kind"/g, "kind")
      .replace(/"label"/g, "label")
      .replace(/"status"/g, "status")
      .replace(/"bytes"/g, "bytes") +
    " as const;",
  "",
  '/** Lookup by path under public/ (no leading slash, e.g. "images/avatar.jpg"). */',
  "export const assets: Readonly<Record<string, Asset>> = Object.freeze(",
  "  Object.fromEntries(manifest.map((a) => [a.path, a]))",
  ");",
  "",
  '/** Convenience: only assets currently present AND non-empty on disk. */',
  'export const presentAssets = manifest.filter((a) => a.status === "present");',
  "",
  "/** Convenience: expected-but-absent assets. */",
  'export const missingAssets = manifest.filter((a) => a.status === "missing");',
  "",
  "/** Convenience: files that exist but carry no bytes -- never render these. */",
  'export const emptyAssets = manifest.filter((a) => a.status === "empty");',
  "",
  "/** All usable assets of one kind, in manifest order. */",
  'export function presentAssetsOfKind(kind: Asset["kind"]): ReadonlyArray<Asset> {',
  "  return presentAssets.filter((a) => a.kind === kind);",
  "}",
  "",
].join("\n");

mkdirSync(dirname(outFile), { recursive: true });

const current = existsSync(outFile) ? readFileSync(outFile, "utf8") : null;
if (current !== tsBody) {
  writeFileSync(outFile, tsBody, "utf8");
  console.info(
    `[sync-assets] wrote ${relative(projectRoot, outFile)} (${records.length} entries)`
  );
} else {
  console.info(`[sync-assets] no changes (${relative(projectRoot, outFile)})`);
}

// Loud, specific warnings -- a zero-byte file is a mistake, not a missing one.
const empties = records.filter((r) => r.status === "empty");
const absent = records.filter((r) => r.status === "missing");
if (empties.length) {
  console.info(
    `[sync-assets] ${empties.length} ZERO-BYTE (treated as unavailable):`
  );
  for (const r of empties) console.info(`  - ${r.path}`);
}
if (absent.length) {
  console.info(`[sync-assets] ${absent.length} missing:`);
  for (const r of absent) console.info(`  - ${r.path}`);
}
const usable = records.length - empties.length - absent.length;
console.info(`[sync-assets] ${usable}/${records.length} indexed assets usable`);

// Never fail the build on missing art: placeholders are a supported state.
process.exit(0);
