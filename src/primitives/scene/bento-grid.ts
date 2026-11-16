// scene/bento-grid. See library/primitives/scene/bento-grid.md.
//
// A bento: tiles of different sizes on one grid, laid out by named areas. Each
// tile is a small screen of its own that cycles through its items on its own
// clock: every tile swaps once a period, a phase apart from its neighbours, so
// the grid is never still and never moves all at once. A tile with one item
// holds (a wordmark, a title). Each tile has its own swap move: slide, flip,
// stack or fade.
//
// Swaps repeat with one period and every tile's first swap falls inside the
// first hold, so a scene as long as `duration` ends on the frame it began on
// (with no entrance, `stagger` 0, and counts that divide the largest).
import { clamp, progress } from '../../core/ease.ts';
import { list, num, nums, str, type Primitive, type PrimitiveIssue } from '../types.ts';
import { wallDelays, type Card } from './grid-wall.ts';

export const SWAPS = ['slide-up', 'slide-left', 'flip', 'stack', 'fade'] as const;
export type Swap = (typeof SWAPS)[number];
/** What `mixed` gives tile 1, 2, 3…: neighbours never share a move. */
const MIXED: readonly Swap[] = ['slide-up', 'flip', 'slide-left', 'stack', 'fade'];

export interface Tile { name: string; col: number; row: number; cols: number; rows: number }

/** "a b c / d b e" (rows split by `/`, `|` or a new line) into rows of names. */
export const parseAreas = (s: string): string[][] =>
  s.split(/[/|\n]/).map((r) => r.trim().split(/\s+/).filter(Boolean)).filter((r) => r.length > 0);

/**
 * The tiles of a named-area grid, in order of first appearance (reading order).
 * Each name must cover one rectangle, and every row must be as long as the first.
 */
export function tilesOf(areas: string): { tiles: Tile[]; cols: number; rows: number; problem?: string } {
  const grid = parseAreas(areas);
  const rows = grid.length, cols = grid[0]?.length ?? 0;
  if (!rows) return { tiles: [], cols: 0, rows: 0, problem: 'areas is empty.' };
  const short = grid.findIndex((r) => r.length !== cols);
  if (short >= 0) return { tiles: [], cols, rows, problem: `Row ${short + 1} has ${grid[short]!.length} cells; the first has ${cols}.` };
  const tiles: Tile[] = [];
  const seen = new Map<string, Tile>();
  grid.forEach((r, y) => r.forEach((name, x) => {
    const t = seen.get(name);
    if (!t) { const n = { name, col: x, row: y, cols: 1, rows: 1 }; seen.set(name, n); tiles.push(n); return; }
    const right = Math.max(t.col + t.cols, x + 1), bottom = Math.max(t.row + t.rows, y + 1);
    t.col = Math.min(t.col, x);
    t.cols = right - t.col;
    t.rows = bottom - t.row;
  }));
  for (const t of tiles) {
    let cells = 0;
    grid.forEach((r, y) => r.forEach((name, x) => { if (name === t.name) cells++; else if (x >= t.col && x < t.col + t.cols && y >= t.row && y < t.row + t.rows) cells = -Infinity; }));
    if (cells !== t.cols * t.rows) return { tiles: [], cols, rows, problem: `Tile "${t.name}" does not cover one rectangle.` };
  }
  return { tiles, cols, rows };
}

/**
 * Which items of each tile, as indices into `items`. With `counts`, tile i takes
 * the next counts[i] items. Without, items are dealt in turn: item k to tile k mod n.
 */
export function dealItems(nItems: number, nTiles: number, counts: readonly number[]): number[][] {
  const out: number[][] = Array.from({ length: nTiles }, () => []);
  if (counts.length) {
    let k = 0;
    counts.forEach((c, i) => { if (i < nTiles) for (let j = 0; j < Math.max(0, Math.round(c)) && k < nItems; j++) out[i]!.push(k++); });
  } else for (let k = 0; k < nItems; k++) out[k % Math.max(1, nTiles)]!.push(k);
  return out;
}

/**
 * When the first swap of each cycling tile starts, in seconds: inside the first
 * hold, a phase of `offset` apart in reading order, the last tile at the end of
 * the hold. Keeping every first swap inside the hold is what lets the grid loop.
 */
export function firstSwaps(cycling: number, start: number, hold: number, offset: number): number[] {
  const h = Math.max(1e-6, hold);
  return Array.from({ length: cycling }, (_, r) => start + h - ((((offset * (cycling - 1 - r)) % h) + h) % h));
}

export interface SwapState {
  /** Item leaving, and item arriving; equal when the tile is at rest. */
  from: number;
  to: number;
  /** Raw progress of the swap, 1 at rest. */
  k: number;
  /** Seconds since the item on top began to arrive: drives the slow push of pictures. */
  age: number;
}

/** The state of a tile of `n` items whose first swap starts at `a`. Swaps repeat every hold + swap. */
export function swapAt(t: number, a: number, n: number, hold: number, swap: number): SwapState {
  const P = hold + swap;
  // A tile that never swaps holds its picture still, so it matches itself across a loop.
  if (n < 2) return { from: 0, to: 0, k: 1, age: 0 };
  if (t < a) return { from: 0, to: 0, k: 1, age: Math.max(0, t - a + P) };
  const m = Math.floor((t - a) / P), r = t - a - m * P;
  if (r < swap) return { from: m % n, to: (m + 1) % n, k: r / swap, age: r };
  return { from: (m + 1) % n, to: (m + 1) % n, k: 1, age: r };
}

const PICTURE = /^(data:image\/|[^<\s]+\.(png|jpe?g|webp|gif|avif|svg)(\?\S*)?$)/i;
/** Fills an item: a picture path becomes a covering image, anything else is markup. */
export function fillItem(host: HTMLElement, item: string): HTMLImageElement | undefined {
  if (PICTURE.test(item.trim())) {
    const img = host.ownerDocument.createElement('img');
    img.src = item.trim();
    img.alt = '';
    img.decoding = 'sync';
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover';
    host.appendChild(img);
    return img;
  }
  host.innerHTML = item;
  return undefined;
}

/** Draws one swap move: `a` leaving, `b` arriving, at eased progress k. */
function drawSwap(move: Swap, a: HTMLElement, b: HTMLElement, k: number): void {
  b.style.zIndex = '2';
  a.style.zIndex = '1';
  switch (move) {
    case 'slide-up':
      a.style.transform = `translateY(${(-100 * k).toFixed(3)}%)`;
      b.style.transform = `translateY(${(100 * (1 - k)).toFixed(3)}%)`;
      break;
    case 'slide-left':
      a.style.transform = `translateX(${(-100 * k).toFixed(3)}%)`;
      b.style.transform = `translateX(${(100 * (1 - k)).toFixed(3)}%)`;
      break;
    case 'flip': {
      // A card turning in its slot: it shrinks a little while edge-on, so its corners stay inside.
      const s = 1 - 0.08 * Math.sin(Math.PI * k);
      a.style.transform = `scale(${s.toFixed(4)}) rotateY(${(180 * k).toFixed(3)}deg)`;
      b.style.transform = `scale(${s.toFixed(4)}) rotateY(${(180 * k - 180).toFixed(3)}deg)`;
      break;
    }
    case 'stack':
      // The new item comes down over the old one, which sinks back and dims beneath it.
      a.style.transform = `translateY(${(6 * k).toFixed(3)}%) scale(${(1 - 0.1 * k).toFixed(4)})`;
      a.style.opacity = (1 - 0.6 * k).toFixed(4);
      b.style.transform = `translateY(${(-100 * (1 - k)).toFixed(3)}%)`;
      break;
    case 'fade':
      // A dissolve straight from one to the other: the old item stays whole beneath.
      b.style.opacity = k.toFixed(4);
      b.style.transform = `scale(${(1.04 - 0.04 * k).toFixed(4)})`;
      break;
  }
}

const PUSH = 0.06;

export const bentoGrid: Primitive = {
  slug: 'scene/bento-grid',
  summary: 'Tiles of different sizes on one grid, each cycling its own content on its own clock.',
  props: {
    areas: { type: 'string', required: true, label: 'The grid as named areas, rows split by "/": "a b c / d b e". A name over several cells is one larger tile' },
    items: { type: 'string[]', required: true, label: 'What the tiles show: markup or a picture path each. Dealt to tiles in turn, or by counts' },
    counts: { type: 'number[]', default: [], label: 'How many items each tile cycles, in tile order (reading order of first appearance). 1 holds still' },
    swaps: { type: 'string[]', default: [], label: 'Swap move per tile: slide-up, slide-left, flip, stack or fade. Left out, the swap param decides' },
  },
  params: {
    width: { type: 'number', default: 92, min: 30, max: 100, step: 1, unit: '% of stage width', label: 'Width of the grid; the margin is the same all round' },
    gap: { type: 'number', default: 14, min: 0, max: 60, step: 1, unit: 'px', label: 'Space between tiles (corners are ¾ of it, or --m-card-radius)' },
    hold: { type: 'number', default: 1.6, min: 0.4, max: 6, step: 0.05, unit: 's', label: 'How long each item rests before its tile swaps again' },
    swap: { type: 'choice', default: 'mixed', options: ['mixed', ...SWAPS], label: 'Swap move for tiles without their own: mixed gives neighbours different moves' },
    swap_time: { type: 'number', default: 0.7, min: 0.2, max: 2, step: 0.05, unit: 's', label: 'Length of one swap' },
    offset: { type: 'number', default: 0.3, min: 0, max: 2, step: 0.05, unit: 's', label: 'Phase between one tile’s swap and the next, in reading order' },
    stagger: { type: 'number', default: 0.06, min: 0, max: 0.2, step: 0.005, unit: 's', label: 'Delay between tiles opening from the centre; 0: the grid is there from the first frame (for loops)' },
  },
  duration(props, p, ctx) {
    const { tiles } = tilesOf(str(props.areas));
    const dealt = dealItems(list(props.items).length, tiles.length, nums(props.counts));
    const stagger = num(p.stagger), enter = stagger > 0 ? Math.max(0, tiles.length - 1) * stagger + ctx.tokens.duration.slow : 0;
    const most = Math.max(0, ...dealt.map((d) => d.length));
    return enter + (most > 1 ? most * (num(p.hold) + num(p.swap_time)) : num(p.hold));
  },
  check(props) {
    const issues: PrimitiveIssue[] = [];
    const { tiles, problem } = tilesOf(str(props.areas));
    if (problem) return [{ path: 'props.areas', message: problem, hint: 'Write rows of equal length, split by "/", and let each name cover one rectangle: "a a b / c d b".' }];
    const n = list(props.items).length, counts = nums(props.counts);
    if (counts.length && counts.length !== tiles.length) {
      issues.push({ path: 'props.counts', message: `counts has ${counts.length} values for ${tiles.length} tiles (${tiles.map((t) => t.name).join(', ')}).`, hint: 'Give one count per tile, in reading order.' });
    } else if (counts.length && counts.reduce((a, b) => a + b, 0) !== n) {
      issues.push({ path: 'props.counts', message: `counts add up to ${counts.reduce((a, b) => a + b, 0)}, but there are ${n} items.`, hint: 'Make the counts add up to the number of items.' });
    }
    if (counts.some((c) => !(c >= 1) || c !== Math.round(c))) issues.push({ path: 'props.counts', message: 'Each count is a whole number, 1 or more.' });
    if (!counts.length && n < tiles.length) issues.push({ path: 'props.items', message: `${n} items for ${tiles.length} tiles: some tiles would be empty.`, hint: 'Give at least one item per tile.' });
    const dealt = dealItems(n, tiles.length, counts);
    const cycling = dealt.map((d) => d.length).filter((c) => c > 1), most = Math.max(0, ...cycling);
    const odd = cycling.filter((c) => most % c !== 0);
    if (odd.length) issues.push({ path: 'props.counts', message: `Tiles cycle ${[...new Set(cycling)].join(', ')} items: at the end, the tiles with ${[...new Set(odd)].join(', ')} are not back on their first item, so a loop would jump.`, hint: `For a loop, give each tile a count that divides ${most}.` });
    list(props.swaps).forEach((s, i) => {
      if (!(SWAPS as readonly string[]).includes(s)) issues.push({ path: `props.swaps[${i}]`, message: `"${s}" is not a swap move.`, hint: `Use one of ${SWAPS.join(', ')}.` });
    });
    return issues;
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [W, H] = ctx.size;
    const { tiles, cols, rows } = tilesOf(str(props.areas));
    const items = list(props.items), dealt = dealItems(items.length, tiles.length, nums(props.counts)), own = list(props.swaps);
    const gw = (num(p.width) / 100) * W, margin = (W - gw) / 2, gh = Math.max(H * 0.1, H - 2 * margin);
    const gap = num(p.gap), cw = (gw - gap * (cols - 1)) / Math.max(1, cols), ch = (gh - gap * (rows - 1)) / Math.max(1, rows);
    const hold = num(p.hold), swap = Math.max(0.01, num(p.swap_time)), stagger = num(p.stagger);
    const P = hold + swap, u = W / 1080;
    const enterEase = ctx.ease(ctx.tokens.ease_enter), moveEase = ctx.ease(ctx.tokens.ease_move);
    const each = ctx.tokens.duration.slow;

    const cards: Card[] = tiles.map((t) => ({ x: t.col * (cw + gap), y: t.row * (ch + gap), w: t.cols * cw + (t.cols - 1) * gap, h: t.rows * ch + (t.rows - 1) * gap }));
    const delays = stagger > 0 ? wallDelays(cards, [gw / 2, gh / 2], stagger) : cards.map(() => 0);
    const enter = stagger > 0 ? Math.max(0, tiles.length - 1) * stagger + each : 0;
    const order = dealt.map((d, i) => (d.length > 1 ? i : -1)).filter((i) => i >= 0);
    const starts = firstSwaps(order.length, enter, hold, num(p.offset));
    const radius = `var(--m-card-radius, ${Math.max(4, Math.round(gap * 0.75))}px)`;

    const grid = doc.createElement('div');
    grid.style.cssText = `position:relative;width:${gw}px;height:${gh}px`;
    const built = tiles.map((t, i) => {
      const c = cards[i]!;
      const tile = doc.createElement('div');
      tile.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;overflow:hidden;border-radius:${radius};`
        + `background:var(--m-bg-sunken);perspective:${(2.5 * Math.max(c.w, c.h)).toFixed(0)}px;isolation:isolate`;
      const rank = order.indexOf(i);
      const move: Swap = (SWAPS as readonly string[]).includes(own[i] ?? '') ? own[i] as Swap
        : str(p.swap) === 'mixed' || !(SWAPS as readonly string[]).includes(str(p.swap)) ? MIXED[Math.max(0, rank) % MIXED.length]! : str(p.swap) as Swap;
      const faces = dealt[i]!.map((k) => {
        const face = doc.createElement('div');
        face.style.cssText = `position:absolute;inset:0;overflow:hidden;border-radius:inherit;background:var(--m-bg-surface);`
          + `display:grid;place-items:center;visibility:hidden;backface-visibility:hidden;font-size:${(28 * u).toFixed(2)}px`;
        const img = fillItem(face, items[k] ?? '');
        tile.appendChild(face);
        return { face, img };
      });
      grid.appendChild(tile);
      return { tile, faces, move, start: rank >= 0 ? starts[rank]! : Infinity, top: c.y };
    });
    el.appendChild(grid);

    return {
      seek(t) {
        built.forEach((b, i) => {
          // Opening: each tile rises and fades in, nearest the centre first. The rise
          // moves the tile by layout, not a transform (see scene/grid-wall).
          const e = stagger > 0 ? progress(t, delays[i]!, each, enterEase) : 1;
          b.tile.style.opacity = e < 1 ? e.toFixed(4) : '';
          b.tile.style.top = `${(b.top + (1 - e) * 24 * u).toFixed(2)}px`;

          const s = swapAt(t, b.start, b.faces.length, hold, swap);
          b.faces.forEach(({ face, img }, j) => {
            const on = j === s.from || j === s.to;
            face.style.visibility = on ? 'inherit' : 'hidden';
            face.style.transform = '';
            face.style.opacity = '';
            face.style.zIndex = '';
            if (img) {
              // A picture drifts in its tile while it can be seen: in from its arrival to its exit.
              const age = j === s.to ? s.age : s.age + P;
              img.style.transform = on ? `scale(${(1 + PUSH * (1 - clamp(age / (P + swap)))).toFixed(4)})` : '';
            }
          });
          if (s.from !== s.to) drawSwap(b.move, b.faces[s.from]!.face, b.faces[s.to]!.face, moveEase(s.k));
        });
      },
    };
  },
};
