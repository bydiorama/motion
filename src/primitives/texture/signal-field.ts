// texture/signal-field. See library/primitives/texture/signal-field.md.
//
// Signal out of noise: points jitter like static, torn now and then by a glitch
// band, then fall into a calm dot grid from the centre out. Once in order, a slow
// pulse travels down the grid, so the field never goes dead still. The field is
// drawn on a canvas; jitter is hashed from the frame number, so every frame is
// the same each time it is drawn.
import { clamp, lerp } from '../../core/ease.ts';
import { fitBitmap } from '../canvas.ts';
import { num, type Primitive } from '../types.ts';

/** Deterministic hash noise in [0, 1). */
export const hash = (a: number, b = 0): number => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};
const inOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

/** A colour as the page resolves it (theme variables, light-dark()), read from a probe. */
function resolved(el: HTMLElement, css: string): string {
  const probe = el.ownerDocument.createElement('span');
  probe.style.color = css;
  probe.style.display = 'none';
  el.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
}
/** `rgb(r, g, b)` as `r,g,b`, ready for an alpha. */
const channels = (rgb: string) => (rgb.match(/[\d.]+/g)?.slice(0, 3) ?? ['255', '255', '255']).join(',');

export const signalField: Primitive = {
  slug: 'texture/signal-field',
  summary: 'Points jitter like static, then fall into a calm dot grid from the centre out.',
  props: {},
  params: {
    cols: { type: 'number', default: 36, min: 16, max: 60, step: 1, unit: 'columns', label: 'Columns of the grid (rows follow the frame)' },
    settle_at: { type: 'number', default: 0.6, min: 0, max: 4, step: 0.05, unit: 's', label: 'When the noise starts to settle' },
    settle: { type: 'number', default: 1.2, min: 0.4, max: 3, step: 0.05, unit: 's', label: 'How long it takes to fall into the grid' },
    jitter: { type: 'number', default: 26, min: 0, max: 60, step: 1, unit: 'px', label: 'How hard the static shakes' },
    glitch: { type: 'number', default: 0.55, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'How often a glitch band tears the noise' },
    pulse: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'Strength of the pulse that travels the grid once in order' },
    accent: { type: 'number', default: 0.07, min: 0, max: 0.2, step: 0.01, unit: 'share', label: 'Share of points in the accent colour' },
  },
  duration: (_props, p) => num(p.settle_at) + num(p.settle),
  build(el, _props, p, ctx) {
    const doc = el.ownerDocument;
    const [W, H] = ctx.size, u = W / 1080, fps = ctx.fps || 30;
    el.style.cssText += ';position:absolute;inset:0;max-width:none;pointer-events:none';
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px`;
    el.appendChild(canvas);
    const g = canvas.getContext('2d');
    const ink = channels(resolved(el, 'currentColor')), accent = channels(resolved(el, 'var(--m-accent)'));

    const GX = Math.max(2, Math.round(num(p.cols))), GY = Math.max(2, Math.round((GX * H) / W));
    const cells = GX * GY, NP = Math.round(cells * 1.6), seed = ctx.seed * 7919;
    const maxD = Math.hypot(W / 2, H / 2);
    const accentShare = num(p.accent);
    const parts = Array.from({ length: NP }, (_, i) => {
      const c = i % cells, k = i + seed;
      const gx = ((c % GX) + 0.5) * (W / GX), gy = (Math.floor(c / GX) + 0.5) * (H / GY);
      return {
        x: hash(k, 1) * W, y: hash(k, 2) * H, vx: (hash(k, 3) - 0.5) * 40 * u, vy: (hash(k, 4) - 0.5) * 24 * u,
        gx, gy, d: Math.hypot(gx - W / 2, gy - H / 2) / maxD,
        r: (0.7 + hash(k, 5) * 1.5) * u, a: 0.18 + hash(k, 6) * 0.5, hot: hash(k, 7) < accentShare,
      };
    });
    const t0 = num(p.settle_at), span = Math.max(0.01, num(p.settle));
    const jit = num(p.jitter) * u, glitch = num(p.glitch), pulse = num(p.pulse);
    return {
      seek(t) {
        if (!g) return;
        const f = Math.round(t * fps);
        fitBitmap(canvas, g, ctx.size, ctx);
        g.clearRect(0, 0, W, H);
        const order = inOut(clamp((t - t0) / span));
        const shake = (1 - order) ** 1.5;
        // A glitch band, re-rolled every 5 frames while the field is still noise.
        const b = Math.floor(f / 5) + seed;
        const bandY = hash(b, 11) * H, bandH = (20 + hash(b, 12) * 120) * u;
        const bandDX = (hash(b, 13) - 0.5) * 140 * u * shake * (hash(b, 14) < glitch ? 1 : 0);
        for (let i = 0; i < NP; i++) {
          const q = parts[i]!, k = i + seed;
          let nx = (q.x + q.vx * t + (hash(k, f) - 0.5) * jit * shake) % W;
          let ny = (q.y + q.vy * t + (hash(k, f + 7777) - 0.5) * jit * shake) % H;
          if (nx < 0) nx += W;
          if (ny < 0) ny += H;
          if (ny > bandY && ny < bandY + bandH) nx += bandDX;
          // Settles from the centre out.
          const o = inOut(clamp(order * 1.35 - q.d * 0.35));
          const x = lerp(nx, q.gx + Math.sin(t * 0.8 + q.gy * 0.01) * 2 * u, o);
          const y = lerp(ny, q.gy, o);
          // Once in order, a slow pulse travels down the grid.
          const wave = Math.max(0, Math.sin((q.gy / H) * 7 - t * 3.2)) ** 6 * o * pulse;
          const flick = lerp(0.35 + hash(k, f + 3) * 0.9, 0.55, o);
          const a = lerp(q.a * flick * 1.25, 0.17 + wave, o);
          const r = lerp(q.r, 1.05 * u, o);
          g.fillStyle = `rgba(${q.hot ? accent : ink},${clamp(q.hot ? a * 1.6 : a).toFixed(3)})`;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
      },
    };
  },
};
