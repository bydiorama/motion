// A canvas drawn in the stage's px, its bitmap sized to what the camera shows: twice the
// stage at rest, and as much more as the camera zooms in, so a close-up stays sharp. The
// camera's scale is the frame's own (ctx.cameraScale), so the bitmap never lags the zoom.
import type { Ctx } from './types.ts';

/** The largest bitmap side drawn: past it a close-up is drawn a little soft rather than not at all. */
export const MAX_BITMAP = 8192;

/** Sizes the bitmap for this frame and sets the transform so drawing is in stage px. Call at the top of seek. */
export function fitBitmap(canvas: HTMLCanvasElement, g: CanvasRenderingContext2D, size: readonly [number, number], ctx: Pick<Ctx, 'cameraScale'>): void {
  const [W, H] = size;
  const scale = Math.min(2 * Math.max(1, ctx.cameraScale?.() ?? 1), MAX_BITMAP / Math.max(W, H));
  const bw = Math.round(W * scale), bh = Math.round(H * scale);
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  g.setTransform(bw / W, 0, 0, bh / H, 0, 0);
}
