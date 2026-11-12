// Closed shapes as point lists, so any two can be morphed: every shape has the same
// number of points, spaced evenly along its outline and starting at 12 o'clock,
// turning clockwise. Pure; a blob takes a seed.
import { rng } from './ease.ts';

export const SHAPES = ['circle', 'square', 'squircle', 'triangle', 'diamond', 'hexagon', 'star', 'pill', 'plus', 'blob'] as const;
export type ShapeName = (typeof SHAPES)[number];
export type Pt = [number, number];

/** A polygon outline from corners, on a unit box centred on 0,0. */
const poly = (corners: Pt[]): Pt[] => corners;
const regular = (n: number, r = 1, turn = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + turn + (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });

/** Points along a closed polyline, evenly spaced by length. */
function resample(outline: Pt[], n: number): Pt[] {
  const segs = outline.map((p, i) => [p, outline[(i + 1) % outline.length]!] as const);
  const lens = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  const total = lens.reduce((x, y) => x + y, 0);
  const out: Pt[] = [];
  let seg = 0, acc = 0;
  for (let i = 0; i < n; i++) {
    const d = (i / n) * total;
    while (seg < segs.length - 1 && acc + lens[seg]! < d) { acc += lens[seg]!; seg++; }
    const [a, b] = segs[seg]!, k = lens[seg]! > 0 ? (d - acc) / lens[seg]! : 0;
    out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
  }
  return out;
}

/** Turns the list so it starts at the point nearest straight up. */
function startAtTop(pts: Pt[]): Pt[] {
  let best = 0, bestA = Infinity;
  pts.forEach(([x, y], i) => {
    const a = Math.abs(Math.atan2(x, -y));
    if (a < bestA) { bestA = a; best = i; }
  });
  return [...pts.slice(best), ...pts.slice(0, best)];
}

function outline(name: ShapeName | string, seed: number): Pt[] {
  const fine = (f: (a: number) => number, n = 360): Pt[] =>
    Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const r = f(a);
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
  switch (name) {
    case 'square': return poly([[0, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]);
    case 'squircle': return fine((a) => 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), 5) + Math.pow(Math.abs(Math.sin(a)), 5), 1 / 5));
    case 'triangle': return regular(3, 1.12, 0).map(([x, y]) => [x, y + 0.14] as Pt);
    case 'diamond': return regular(4, 1.1);
    case 'hexagon': return regular(6, 1.04);
    case 'star': return regular(10, 1).map(([x, y], i) => (i % 2 ? [x * 0.46, y * 0.46] : [x * 1.08, y * 1.08]) as Pt);
    case 'pill': return fine((a) => {
      // A stadium twice as wide as tall.
      const c = Math.cos(a), s = Math.sin(a);
      const r = 0.5, half = 0.5;
      let lo = 0, hi = 2;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2, x = c * m, y = s * m;
        const dx = Math.max(0, Math.abs(x) - half);
        if (Math.hypot(dx, y) > r) hi = m; else lo = m;
      }
      return lo * 1.9;
    });
    case 'plus': {
      const w = 0.36;
      return poly([[-w, -1], [w, -1], [w, -w], [1, -w], [1, w], [w, w], [w, 1], [-w, 1], [-w, w], [-1, w], [-1, -w], [-w, -w]]);
    }
    case 'blob': {
      const r = rng(seed * 53 + 11);
      const k = [r(), r(), r(), r()].map((v) => v * Math.PI * 2);
      return fine((a) => 0.9 + 0.08 * Math.sin(2 * a + k[0]!) + 0.06 * Math.sin(3 * a + k[1]!) + 0.04 * Math.sin(5 * a + k[2]!) + 0.02 * Math.sin(7 * a + k[3]!));
    }
    default: return fine(() => 1);
  }
}

/** `n` points around a named shape that fills a box from -1 to 1. */
export function shapePoints(name: ShapeName | string, n = 120, seed = 1): Pt[] {
  return startAtTop(resample(outline(name, seed), n));
}

export const lerpPoints = (a: Pt[], b: Pt[], k: number): Pt[] => a.map(([x, y], i) => [x + (b[i]![0] - x) * k, y + (b[i]![1] - y) * k]);

/** SVG path data for a closed point list, scaled by r around cx, cy. */
export const pointsPath = (pts: Pt[], cx: number, cy: number, r: number): string =>
  `M${pts.map(([x, y]) => `${(cx + x * r).toFixed(2)},${(cy + y * r).toFixed(2)}`).join('L')}Z`;
