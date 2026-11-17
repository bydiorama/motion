// transition/strip-wipe. See library/primitives/transition/strip-wipe.md.
//
// The frame is cut into horizontal strips, the rows of a ruled grid. The next
// scene arrives strip by strip, one row a step after the last, each row led by a
// field of colour that runs across ahead of it: a staircase of colour that wipes
// the old scene away. It is the change of scene/strip-cycle, made into a
// hand-over between scenes. In `cover` mode the rows first close over the old scene,
// hold the frame in colour for an instant on the cut, then open on the next.
import { clamp } from '../../core/ease.ts';
import { num, str, type TransitionPrimitive } from '../types.ts';
import { bandColour } from './band-sweep.ts';
import { clearOverlays, fillOf, overlay } from './overlay.ts';

const KEY = 'strips';
const COLOURS = ['band-1', 'band-2', 'band-3', 'band-4', 'band-5', 'band-6', 'accent', 'inverse', 'surface', 'sunken'] as const;
/** A band of the identity's palette (`--m-band-1` … `--m-band-6`) or a surface of the stage. */
export const stripColour = (v: string): string => (/^band-[1-6]$/.test(v) ? bandColour(Number(v.slice(5)) - 1) : fillOf(v));

/** How far each row trails the one before, as a share of the hand-over: the stagger, capped so the last row still travels for half of it. */
export const rowLag = (rows: number, stagger: number): number => Math.min(Math.max(0, stagger), 0.5 / Math.max(1, rows - 1));

/**
 * How far row i has run at progress k, 0 to 1. Rows start a lag apart in `order`
 * and all finish at k = 1, so the hand-over takes exactly its duration.
 */
export function rowAt(k: number, i: number, rows: number, lag: number, order: string, ease: (x: number) => number): number {
  const rank = order === 'up' ? rows - 1 - i : order === 'centre' ? Math.abs(i - (rows - 1) / 2) * 2 : i;
  const win = Math.max(0.05, 1 - (rows - 1) * lag);
  return ease(clamp((k - rank * lag) / win));
}

/**
 * The span of a row at run r, in px along the travel from the side it enters: the
 * colour field lies over [front, front + field] and the next scene behind it, over
 * [front + field, length]. The field enters first and leaves last.
 */
export function rowSpan(r: number, length: number, field: number): { front: number; back: number } {
  const front = length - r * (length + field);
  return { front, back: front + field };
}

export interface RowLayout {
  /** The colour field, [from, to] in px, measured from the edge the row leaves by. */
  field: [number, number];
  /** Where the next scene shows, [from, to] in px, or null while it is hidden. */
  shown: [number, number] | null;
}

/**
 * Row i at progress k, in px across a row `length` long, as if it entered from the far
 * edge (positions grow towards it). `lead`: a field `field` px long runs across with the
 * next scene behind it. `cover`: the rows first cover the old scene with colour, every
 * row whole at k = 0.5, then run on and uncover the next scene: a held beat of colour
 * on the cut.
 */
export function rowLayout(k: number, i: number, rows: number, length: number, o: { mode: string; field: number; lag: number; order: string; ease: (x: number) => number }): RowLayout {
  if (o.mode === 'cover') {
    if (k < 0.5) {
      const p = rowAt(k * 2, i, rows, o.lag, o.order, o.ease);
      return { field: [length - p * length, length], shown: null };
    }
    const p = rowAt(k * 2 - 1, i, rows, o.lag, o.order, o.ease);
    const edge = length - p * length;
    return { field: [0, edge], shown: edge < length ? [edge, length] : null };
  }
  const { front, back } = rowSpan(rowAt(k, i, rows, o.lag, o.order, o.ease), length, o.field);
  return { field: [front, back], shown: back < length ? [Math.max(0, back), length] : null };
}

export const stripWipe: TransitionPrimitive = {
  slug: 'transition/strip-wipe',
  summary: 'The next scene arrives row by row, each row led by a field of colour.',
  duration: 1,
  params: {
    duration: { type: 'number', default: 1, min: 0.5, max: 2, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    mode: { type: 'choice', default: 'lead', options: ['lead', 'cover'], label: 'lead: a field of colour runs ahead of the next scene; cover: colour covers the frame, then uncovers the next scene' },
    direction: { type: 'choice', default: 'left', options: ['left', 'right'], label: 'Which way the strips run: left enters from the right' },
    alternate: { type: 'boolean', default: false, label: 'Every other row runs the other way, like strands woven across' },
    rows: { type: 'number', default: 8, min: 2, max: 16, step: 1, unit: 'rows', label: 'Strips across the frame: the rows of the grid' },
    order: { type: 'choice', default: 'down', options: ['down', 'up', 'centre'], label: 'Which row goes first' },
    stagger: { type: 'number', default: 0.04, min: 0, max: 0.1, step: 0.005, unit: 'ratio', label: 'How far each row trails the one before, as a share of the hand-over' },
    lead: { type: 'number', default: 0.35, min: 0.05, max: 1, step: 0.01, unit: '× frame width', label: 'Length of the colour field ahead of the next scene' },
    colour: { type: 'choice', default: 'band-1', options: COLOURS, label: 'Colour of the field: a band of the palette (--m-band-1 …) or a surface' },
  },
  apply(from, to, k, p, ctx) {
    const [W, H] = ctx.size;
    const n = Math.max(2, Math.round(num(p.rows, 8)));
    const o = {
      mode: str(p.mode, 'lead'),
      field: Math.ceil(num(p.lead, 0.35) * W),
      lag: rowLag(n, num(p.stagger, 0.04)),
      order: str(p.order, 'down'),
      ease: ctx.ease(str(p.mode, 'lead') === 'cover' ? 'cubic.inOut' : 'quart.inOut'),
    };
    const leftward = str(p.direction, 'left') !== 'right', alternate = p.alternate === true;
    const colour = stripColour(str(p.colour, 'band-1'));
    const fields = overlay(from, KEY, n);
    const shown: string[] = [];
    for (let i = 0; i < n; i++) {
      // Rows on whole pixels, overlapping by one, so no seam shows between them.
      const top = Math.floor((i / n) * H), bottom = Math.min(H, Math.ceil(((i + 1) / n) * H) + 1);
      const row = rowLayout(k, i, n, W, o);
      // Leftward, positions run from the left edge as laid out; rightward, mirrored.
      const flip = alternate && i % 2 === 1 ? leftward : !leftward;
      const span = ([u, v]: [number, number]): [number, number] => (flip ? [W - v, W - u] : [u, v]);
      const [f0, f1] = span(row.field);
      const el = fields[i]!;
      const a = Math.max(0, f0), b = Math.min(W, f1);
      el.style.inset = 'auto';
      el.style.left = `${a.toFixed(2)}px`;
      el.style.top = `${top}px`;
      el.style.width = `${Math.max(0, b - a).toFixed(2)}px`;
      el.style.height = `${bottom - top}px`;
      el.style.background = colour;
      el.style.visibility = b > a ? 'visible' : 'hidden';
      if (row.shown) {
        const [s0, s1] = span(row.shown);
        if (s1 > s0) shown.push(`M${Math.max(0, s0).toFixed(2)} ${top}H${Math.min(W, s1).toFixed(2)}V${bottom}H${Math.max(0, s0).toFixed(2)}Z`);
      }
    }
    from.style.opacity = '1';
    to.style.opacity = shown.length ? '1' : '0';
    to.style.zIndex = '2';
    from.style.zIndex = '1';
    to.style.clipPath = k >= 1 ? '' : shown.length ? `path('${shown.join(' ')}')` : '';
  },
  clear(el) {
    clearOverlays(el, KEY);
    el.style.clipPath = '';
    el.style.zIndex = '';
    el.style.opacity = '';
  },
};
