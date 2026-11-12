// Stagger distribution: in what order a group of units starts, and how far apart.
// Pure, so a primitive's duration can be computed in Node.
import { rng } from './ease.ts';

export const STAGGER_FROM = ['start', 'end', 'center', 'edges', 'random'] as const;
export type StaggerFrom = (typeof STAGGER_FROM)[number];

/**
 * The step at which each of `n` units starts, 0 for the first to go. Units the
 * same distance from the origin share a step, so a stagger from the centre of a
 * line starts its two middle letters together. A `grid` of [columns, rows]
 * measures distance in two dimensions, which turns a stagger into a wave.
 */
export function staggerSteps(n: number, from: StaggerFrom | string = 'start', seed = 1, grid?: [number, number]): number[] {
  if (n <= 0) return [];
  if (from === 'random') {
    // A seeded shuffle: every unit gets its own step, in an order that repeats.
    const r = rng(seed * 977 + n);
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    // On a grid, a random order spans as many steps as a wave across it would.
    const scale = grid && n > 1 ? Math.hypot(grid[0] - 1, grid[1] - 1) / (n - 1) : 1;
    const steps = new Array<number>(n);
    order.forEach((unit, step) => { steps[unit] = step * scale; });
    return steps;
  }
  const [cols, rows] = grid ?? [n, 1];
  const pos = (i: number) => [i % cols, Math.floor(i / cols)] as const;
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
  const dist = (i: number) => {
    const [x, y] = pos(i);
    if (from === 'end') return Math.hypot(cols - 1 - x, rows - 1 - y);
    if (from === 'center') return Math.hypot(x - cx, y - cy);
    if (from === 'edges') return Math.hypot(cx, cy) - Math.hypot(x - cx, y - cy);
    return Math.hypot(x, y);
  };
  const d = Array.from({ length: n }, (_, i) => dist(i));
  // On a line, the two middle units of an even count share step 0.
  if (!grid) return d.map((v) => Math.floor(v + 1e-9));
  return d; // on a grid the steps are continuous: a ripple, not rows
}

/** Steps scaled so the last unit starts at `(span) * stagger` seconds. */
export function staggerDelays(n: number, stagger: number, from: StaggerFrom | string = 'start', seed = 1, grid?: [number, number]): number[] {
  const steps = staggerSteps(n, from, seed, grid);
  const max = Math.max(0, ...steps);
  // A line staggered from its centre takes half as many steps as one from its start;
  // keep the per-step delay, which is what a designer tunes.
  return steps.map((s) => (max > 0 ? s * stagger : 0));
}

/** How many stagger steps the group spans: the last delay divided by the stagger. */
export function staggerSpan(n: number, from: StaggerFrom | string = 'start', seed = 1, grid?: [number, number]): number {
  return Math.max(0, ...staggerSteps(n, from, seed, grid));
}
