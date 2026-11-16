// Building films in code. A film is JSON, and for a short film writing it by
// hand is the clearest route. When a film repeats itself (a card per photo, a
// frame per year, a pin per stop) write a script instead: it returns the film,
// and `motion make script.mjs` checks it and writes the .film.json.
//
//   import { film, scene, layer, repeat, grid, staggerFrom } from '@bydiorama/motion/build';
//   export default film({ size: [1920, 1080], scenes: [
//     scene('wall', staggerFrom(repeat(12, (i) => layer(`card-${i}`, 'el/image', {
//       props: { src: `photos/${i}.jpg` }, place: grid(12, 4)[i],
//     })), { focus: [50, 40], step: 0.05 })),
//   ] });
//
// Everything here returns plain film JSON; nothing is hidden from `motion inspect`.
import { staggerByDistance } from '../core/stagger.ts';
import type { Film, Layer, Place, Scene } from '../film/types.ts';
import { VERSION } from '../version.ts';

type Without<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** A film, with the library version filled in. */
export const film = (spec: Without<Film, 'motion'>): Film => ({ motion: VERSION, ...spec });

/** A scene. Layers may be nested lists, as `repeat` returns; they are flattened. */
export const scene = (id: string, layers: (Layer | Layer[])[], more: Omit<Partial<Scene>, 'id' | 'layers'> = {}): Scene =>
  ({ id, ...more, layers: layers.flat() });

/** A layer: a primitive slug with its props, params, timing and placement. */
export const layer = (id: string, use: string, more: Omit<Partial<Layer>, 'id' | 'use'> = {}): Layer => ({ id, use, ...more });

/** `n` of something: `fn(i)` for i from 0, flattened when it returns several. */
export function repeat<T>(n: number, fn: (i: number) => T | T[]): T[] {
  return Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => fn(i)).flat() as T[];
}

/**
 * Places for `count` items in rows of `columns`, centred in an area of the stage
 * given in %: `{ x: [left, right], y: [top, bottom] }`, the whole stage less a
 * margin by default.
 */
export function grid(count: number, columns: number, area: { x?: [number, number]; y?: [number, number] } = {}): Place[] {
  const [x0, x1] = area.x ?? [10, 90], [y0, y1] = area.y ?? [12, 88];
  const cols = Math.max(1, Math.round(columns)), rows = Math.max(1, Math.ceil(count / cols));
  const cell = (a: number, b: number, n: number, i: number) => a + ((b - a) * (i + 0.5)) / n;
  return repeat(count, (i) => ({ x: round(cell(x0, x1, cols, i % cols)), y: round(cell(y0, y1, rows, Math.floor(i / cols))) }));
}

/**
 * Times placed layers so the nearest to `focus` (in % of the stage) start first,
 * `step` seconds apart, from `start`. Layers at the same distance start together.
 * Layers without `place` keep their own `at`.
 */
export function staggerFrom<T extends Layer>(layers: T[], opts: { focus: [number, number]; step: number; start?: number; aspect?: number }): T[] {
  // Distances are measured on the stage, so % across counts for more on a wide frame.
  const aspect = opts.aspect ?? 16 / 9;
  const placed = layers.filter((l) => l.place);
  const steps = staggerByDistance(placed.map((l) => [l.place!.x * aspect, l.place!.y] as const), [opts.focus[0] * aspect, opts.focus[1]], 0.01);
  const at = new Map(placed.map((l, i) => [l, round((opts.start ?? 0) + steps[i]! * opts.step, 4)]));
  return layers.map((l) => (at.has(l) ? { ...l, at: at.get(l)! } : l));
}

/** Times layers one after another: each starts `gap` seconds after the previous one ends. */
export function sequence<T extends Layer>(layers: T[], gap = 0, start: number | string = 0): T[] {
  return layers.map((l, i) => ({ ...l, at: i === 0 ? start : `${layers[i - 1]!.id}.end${gap ? ` ${gap < 0 ? '-' : '+'} ${Math.abs(gap)}` : ''}` }));
}

const round = (n: number, d = 3) => Number(n.toFixed(d));
