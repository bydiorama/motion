// texture/beat-field. See library/primitives/texture/beat-field.md.
//
// A quiet dot lattice lit by the music: a soft light at its centre breathes on
// every beat (a lift that dies away before the next), and a thin ring of light
// leaves the centre on each one, lighting only the dots it passes. The phase
// comes from the film's clock and its tempo, never from when the layer started,
// so every beat lands on the music however the film is cut. The bitmap is sized
// to the camera's zoom, so the dots stay round and sharp in a close-up.
import { clamp } from '../../core/ease.ts';
import { fitBitmap } from '../canvas.ts';
import { list, num, type Primitive } from '../types.ts';

/** The light at a moment `beats` into the music: the breath, and the ring's radius (px at 1080) and opacity. */
export function beatLight(beats: number, p: { decay: number; ring: number; reach: number; life: number }): { breathe: number; ringR: number; ringA: number } {
  const phase = beats - Math.floor(beats);
  const breathe = 0.6 + 0.4 * Math.exp(-phase * p.decay);
  const k = clamp(phase / p.life), out = 1 - (1 - k) ** 3;
  return { breathe, ringR: 60 + out * (p.reach - 60), ringA: k >= 1 ? 0 : p.ring * (1 - out) };
}

/** Rgb channels of a CSS colour as the page resolves it. */
function channels(el: HTMLElement, css: string): string {
  const probe = el.ownerDocument.createElement('span');
  probe.style.color = css;
  probe.style.display = 'none';
  el.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return (c.match(/[\d.]+/g)?.slice(0, 3) ?? ['255', '255', '255']).join(',');
}

export const beatField: Primitive = {
  slug: 'texture/beat-field',
  summary: 'A quiet dot lattice whose light breathes on the beat, with a ring of light leaving the centre on each one.',
  props: {
    clear: { type: 'string[]', default: [], label: 'Ids of layers on the field: no dot is drawn under them' },
  },
  params: {
    pitch: { type: 'number', default: 18, min: 8, max: 60, step: 1, unit: 'px', label: 'Distance between dots' },
    dot: { type: 'number', default: 0.33, min: 0.1, max: 0.5, step: 0.01, unit: 'ratio', label: 'Dot radius, as a share of the pitch' },
    paper: { type: 'number', default: 0.045, min: 0, max: 0.2, step: 0.005, unit: 'opacity', label: 'How much every dot shows, unlit' },
    glow: { type: 'number', default: 0.13, min: 0, max: 0.4, step: 0.01, unit: 'opacity', label: 'The light at the centre, at the top of a breath' },
    glow_radius: { type: 'number', default: 320, min: 80, max: 1200, step: 10, unit: 'px', label: 'How far the centre light reaches' },
    decay: { type: 'number', default: 3.2, min: 0.5, max: 8, step: 0.1, unit: 'per beat', label: 'How fast a breath dies away' },
    ring: { type: 'number', default: 0.22, min: 0, max: 0.6, step: 0.01, unit: 'opacity', label: 'The ring of light at its start (0: no ring)' },
    ring_reach: { type: 'number', default: 620, min: 120, max: 2000, step: 10, unit: 'px', label: 'How far the ring travels in a beat' },
    ring_life: { type: 'number', default: 0.95, min: 0.3, max: 1, step: 0.05, unit: 'beats', label: 'Share of a beat the ring takes to fade' },
    center_x: { type: 'number', default: 50, min: 0, max: 100, step: 0.5, unit: '% of width', label: 'Centre of the light, across' },
    center_y: { type: 'number', default: 50, min: 0, max: 100, step: 0.5, unit: '% of height', label: 'Centre of the light, down' },
    period: { type: 'number', default: 0.5, min: 0.2, max: 2, step: 0.01, unit: 's', label: 'Seconds per beat when the film has no tempo' },
  },
  // Ambient: it runs for as long as its scene.
  duration: () => 0,
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [W, H] = ctx.size, u = W / 1080;
    el.style.cssText += ';position:absolute;left:0;top:0;width:100%;height:100%;max-width:none;pointer-events:none';
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px`;
    el.appendChild(canvas);
    const g = canvas.getContext('2d');
    const ink = channels(el, 'currentColor'), accent = channels(el, 'var(--m-accent)');
    const beat = ctx.beat ?? Math.max(0.05, num(p.period)), start = ctx.filmStart ?? 0;
    const pitch = num(p.pitch) * u, r = num(p.dot) * pitch, paper = num(p.paper), glow = num(p.glow), glowR = num(p.glow_radius) * u;
    const light = { decay: num(p.decay), ring: num(p.ring), reach: num(p.ring_reach), life: num(p.ring_life) };
    const cx = (num(p.center_x) / 100) * W, cy = (num(p.center_y) / 100) * H;
    // The lattice is laid on the centre, so the light's centre is always a dot.
    const dots: [number, number, number][] = [];
    const nx = Math.ceil(cx / pitch) + 1, ny = Math.ceil(cy / pitch) + 1;
    for (let j = -ny; j <= Math.ceil((H - cy) / pitch) + 1; j++) for (let i = -nx; i <= Math.ceil((W - cx) / pitch) + 1; i++) {
      const x = cx + i * pitch, y = cy + j * pitch;
      dots.push([x, y, Math.hypot(x - cx, y - cy)]);
    }
    let kept: typeof dots | undefined;
    const clearIds = list(props.clear);
    return {
      seek(t) {
        if (!g) return;
        // Marks are measured on the first frame drawn: every layer is built by then.
        if (!kept) {
          const holes = clearIds.map((id) => ctx.boxOf?.(id)).filter((b): b is NonNullable<typeof b> => !!b);
          kept = dots.filter(([x, y]) => !holes.some((b) => x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r));
        }
        fitBitmap(canvas, g, ctx.size, ctx);
        g.clearRect(0, 0, W, H);
        const { breathe, ringR, ringA } = beatLight((start + t) / beat, light);
        const R = ringR * u, band = 40 * u;
        // The light itself, soft, under the dots.
        const halo = g.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        halo.addColorStop(0, `rgba(${accent},${(0.07 * breathe).toFixed(4)})`);
        halo.addColorStop(0.55, `rgba(${accent},${(0.025 * breathe).toFixed(4)})`);
        halo.addColorStop(1, `rgba(${accent},0)`);
        g.fillStyle = halo;
        g.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
        for (const [x, y, d] of kept) {
          // Lit by the centre's breath and by the ring as it passes.
          const q = d / glowR, core = q >= 1 ? 0 : q < 0.45 ? 1 - (q / 0.45) * (1 - 0.05 / 0.13) : (0.05 / 0.13) * (1 - (q - 0.45) / 0.55);
          const ring = ringA > 0 ? ringA * Math.max(0, 1 - Math.abs(d - R) / band) : 0;
          const lit = glow * breathe * core + ring;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          if (paper > 0) { g.fillStyle = `rgba(${ink},${paper})`; g.fill(); }
          if (lit > 0.002) { g.fillStyle = `rgba(${accent},${Math.min(1, lit).toFixed(4)})`; g.fill(); }
        }
      },
    };
  },
};
