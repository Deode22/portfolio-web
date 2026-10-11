/**
 * WebGL feature detection for the map fallback path.
 * Conservative: returns false on any failure rather than throwing.
 *
 * The probe context is explicitly released: browsers cap the number of live
 * WebGL contexts per page (Chrome allows 16), and each probe that keeps its
 * context burns one permanently — enough probes would starve MapLibre's own
 * context and make the map fail for a reason that looks unrelated.
 */
export function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  let ctx: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  try {
    const canvas = document.createElement("canvas");
    ctx =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    return Boolean(ctx);
  } catch {
    return false;
  } finally {
    ctx?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
