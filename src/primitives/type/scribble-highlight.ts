// type/scribble-highlight. See library/primitives/type/scribble-highlight.md.
import { progress, rng } from '../../core/ease.ts';
import { bare, splitText } from '../split.ts';
import { list, num, str, type Primitive } from '../types.ts';

const SVG = 'http://www.w3.org/2000/svg';

/** A hand-drawn path for a mark over a box w × h, wobbling a little by seed. */
function markPath(kind: string, w: number, h: number, r: () => number): string {
  const j = (a: number) => (r() - 0.5) * a; // jitter
  if (kind === 'circle') {
    // A loop that overshoots its start, as a pen does.
    const cx = w / 2, cy = h / 2, rx = w / 2 + h * 0.35, ry = h * 0.72;
    const pts: string[] = [];
    for (let i = 0; i <= 28; i++) {
      const a = -Math.PI * 0.62 + (i / 28) * Math.PI * 2.18;
      const wob = 1 + j(0.06);
      pts.push(`${(cx + Math.cos(a) * rx * wob).toFixed(1)},${(cy + Math.sin(a) * ry * wob + (i / 28) * h * 0.08).toFixed(1)}`);
    }
    return `M${pts.join('L')}`;
  }
  if (kind === 'strike') return `M${-h * 0.1},${h * 0.56 + j(4)} C${w * 0.3},${h * 0.5 + j(6)} ${w * 0.7},${h * 0.6 + j(6)} ${w + h * 0.1},${h * 0.5 + j(4)}`;
  if (kind === 'marker') {
    // Two strokes of a broad marker, back and forth.
    const y1 = h * 0.42, y2 = h * 0.7;
    return `M${-h * 0.08},${y1 + j(4)} L${w + h * 0.1},${y1 + j(5)} L${-h * 0.05},${y2 + j(5)} L${w + h * 0.06},${y2 + j(4)}`;
  }
  // underline: a confident stroke that rises a touch at the end
  const y = h * 1.02;
  return `M${-h * 0.05},${y + j(3)} C${w * 0.35},${y + h * 0.06 + j(4)} ${w * 0.65},${y - h * 0.02 + j(4)} ${w + h * 0.12},${y - h * 0.12 + j(3)}`;
}

export const scribbleHighlight: Primitive = {
  slug: 'type/scribble-highlight',
  summary: 'A hand-drawn mark draws under or around a word.',
  props: {
    text: { type: 'string', required: true, label: 'The sentence' },
    mark: { type: 'string[]', required: true, label: 'Words to mark (a run of words gets one mark)' },
  },
  params: {
    duration: { type: 'number', default: 0.5, min: 0.3, max: 0.9, step: 0.05, unit: 's', label: 'Time to draw the mark' },
    kind: { type: 'choice', default: 'underline', options: ['underline', 'circle', 'marker', 'strike'], label: 'Mark' },
    delay: { type: 'number', default: 0.3, min: 0, max: 2, step: 0.05, unit: 's', label: 'Wait before drawing' },
    weight: { type: 'number', default: 0.08, min: 0.03, max: 0.4, step: 0.01, unit: 'em', label: 'Stroke weight (a marker uses about 0.35)' },
  },
  duration: (_props, p) => num(p.delay) + num(p.duration),
  build(el, props, p, ctx) {
    const marked = new Set(list(props.mark).map(bare));
    const { words } = splitText(el, str(props.text));
    el.style.position = 'relative';
    const hit = words.filter((w) => marked.has(bare(w.textContent ?? '')));
    if (!hit.length) return { seek() {} };
    // One mark over the run from the first to the last marked word on that line.
    const first = hit[0]!, last = hit[hit.length - 1]!;
    const box = el.getBoundingClientRect(), a = first.getBoundingClientRect(), b = last.getBoundingClientRect();
    const scale = el.offsetWidth > 0 ? box.width / el.offsetWidth : 1;
    const x = (a.left - box.left) / scale, y = (a.top - box.top) / scale;
    const w = (b.right - a.left) / scale, h = a.height / scale;
    const kind = str(p.kind), size = parseFloat(getComputedStyle(el).fontSize) || 16;
    const svg = el.ownerDocument.createElementNS(SVG, 'svg');
    svg.setAttribute('width', String(w)); svg.setAttribute('height', String(h));
    svg.style.cssText = `position:absolute;left:${x}px;top:${y}px;overflow:visible;pointer-events:none;${kind === 'marker' ? 'z-index:-1;mix-blend-mode:multiply' : ''}`;
    const path = el.ownerDocument.createElementNS(SVG, 'path');
    path.setAttribute('d', markPath(kind, w, h, rng(ctx.seed * 31 + w)));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', kind === 'marker' ? 'color-mix(in srgb, var(--m-accent) 45%, transparent)' : 'var(--m-accent)');
    path.setAttribute('stroke-width', String(num(p.weight) * size * (kind === 'marker' ? 4.4 : 1)));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('pathLength', '1');
    path.setAttribute('stroke-dasharray', '1 1');
    svg.appendChild(path);
    el.style.isolation = 'isolate';
    el.appendChild(svg);
    const ease = ctx.ease('quart.inOut'), delay = num(p.delay), dur = num(p.duration);
    return {
      seek(t) {
        const k = progress(t, delay, dur, ease);
        path.setAttribute('stroke-dashoffset', (1 - k).toFixed(4));
        svg.style.visibility = k <= 0 ? 'hidden' : 'inherit';
      },
    };
  },
};
