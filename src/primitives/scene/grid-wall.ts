// scene/grid-wall. See library/primitives/scene/grid-wall.md.
//
// A wall of pictures in columns: each goes under the shortest column, so
// pictures of different proportions pack as masonry and equal ones make a
// regular grid. Cards open nearest the focus point first, then the whole wall
// drifts up at a constant speed.
import { progress } from '../../core/ease.ts';
import { staggerByDistance } from '../../core/stagger.ts';
import { list, nums, num, type Primitive } from '../types.ts';

export interface Card { x: number; y: number; w: number; h: number }

/**
 * Masonry: each card, in order, goes to the shortest column. `ratios` are
 * width / height; the wall is `width` px wide. Returns the cards and the height.
 */
export function masonry(ratios: readonly number[], columns: number, width: number, gap: number): { cards: Card[]; height: number } {
  const cols = Math.max(1, Math.round(columns));
  const w = (width - gap * (cols - 1)) / cols;
  const heights = new Array<number>(cols).fill(0);
  const cards = ratios.map((r) => {
    let c = 0;
    for (let i = 1; i < cols; i++) if (heights[i]! < heights[c]! - 0.5) c = i;
    const h = w / (r > 0 ? r : 1);
    const card = { x: c * (w + gap), y: heights[c]!, w, h };
    heights[c] = heights[c]! + h + gap;
    return card;
  });
  return { cards, height: Math.max(0, Math.max(...heights) - gap) };
}

/** Delays, nearest the focus first, spread so the last card always starts at (n − 1) × stagger. */
export function wallDelays(cards: readonly Card[], focus: [number, number], stagger: number): number[] {
  const steps = staggerByDistance(cards.map((c) => [c.x + c.w / 2, c.y + c.h / 2] as const), focus);
  const max = Math.max(0, ...steps), span = Math.max(0, cards.length - 1) * stagger;
  return steps.map((s) => (max > 0 ? (s / max) * span : 0));
}

export const gridWall: Primitive = {
  slug: 'scene/grid-wall',
  summary: 'A masonry or regular grid of media.',
  props: {
    images: { type: 'string[]', required: true, label: 'Pictures, in order: each goes under the shortest column' },
    ratios: { type: 'number[]', default: [], label: 'Width ÷ height of each picture. Left out, read from the files once they load' },
  },
  params: {
    columns: { type: 'number', default: 4, min: 2, max: 8, step: 1, unit: 'cols', label: 'Columns' },
    width: { type: 'number', default: 90, min: 20, max: 200, step: 1, unit: '% of stage width', label: 'Width of the wall' },
    gap: { type: 'number', default: 16, min: 0, max: 80, step: 1, unit: 'px', label: 'Space between pictures (corners are ¾ of it, or --m-card-radius)' },
    stagger: { type: 'number', default: 0.05, min: 0.01, max: 0.15, step: 0.005, unit: 's', label: 'Delay between pictures' },
    focus_x: { type: 'number', default: 50, min: 0, max: 100, step: 1, unit: '% of the wall', label: 'Where the opening starts, across', pad: { name: 'focus', axis: 'x' } },
    focus_y: { type: 'number', default: 50, min: 0, max: 100, step: 1, unit: '% of the wall', label: 'Where the opening starts, down', pad: { name: 'focus', axis: 'y' } },
    drift_speed: { type: 'number', default: 20, min: 0, max: 40, step: 1, unit: 'px/s', label: 'Upward drift of the whole wall; 0 holds it still' },
  },
  duration: (props, p, ctx) => Math.max(0, list(props.images).length - 1) * num(p.stagger) + ctx.tokens.duration.slow,
  check(props) {
    const n = list(props.images).length, r = nums(props.ratios);
    if (r.length && r.length !== n) return [{ path: 'props.ratios', message: `ratios has ${r.length} values for ${n} pictures.`, hint: 'Give one per picture, or leave ratios out.' }];
    if (r.some((v) => !(v > 0))) return [{ path: 'props.ratios', message: 'Each ratio is width ÷ height, above zero.' }];
    return [];
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const srcs = list(props.images), given = nums(props.ratios);
    const width = (num(p.width) / 100) * ctx.size[0], gap = num(p.gap), cols = num(p.columns);
    const stagger = num(p.stagger), each = ctx.tokens.duration.slow, drift = num(p.drift_speed);
    const ease = ctx.ease(ctx.tokens.ease_enter);
    const wall = doc.createElement('div');
    wall.style.cssText = `position:relative;width:${width}px`;
    const imgs = srcs.map((src) => {
      const img = doc.createElement('img');
      img.src = src;
      img.alt = '';
      img.decoding = 'sync';
      img.style.cssText = `position:absolute;display:block;object-fit:cover;border-radius:var(--m-card-radius, ${Math.round(gap * 0.75)}px)`;
      wall.appendChild(img);
      return img;
    });
    el.appendChild(wall);
    // Proportions come from the film, or from the files once decoded: the layout
    // is redone when they change, and is final by the time a render starts.
    let key = '', delays: number[] = [], tops: number[] = [];
    const layout = () => {
      const ratios = imgs.map((img, i) => given[i] ?? (img.naturalWidth > 0 ? img.naturalWidth / img.naturalHeight : 1));
      const next = ratios.map((r) => r.toFixed(4)).join();
      if (next === key) return;
      key = next;
      const { cards, height } = masonry(ratios, cols, width, gap);
      wall.style.height = `${height}px`;
      cards.forEach((c, i) => Object.assign(imgs[i]!.style, { left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px` }));
      tops = cards.map((c) => c.y);
      delays = wallDelays(cards, [(num(p.focus_x) / 100) * width, (num(p.focus_y) / 100) * height], stagger);
    };
    layout();
    return {
      seek(t) {
        layout();
        imgs.forEach((img, i) => {
          const k = progress(t, delays[i]!, each, ease);
          img.style.opacity = k.toFixed(4);
          // The rise moves the tile by layout, not a transform: in Chromium a picture
          // rising by transform came out differently depending on the frame drawn
          // before it, so `check` could not get the same frame twice.
          img.style.top = `${(tops[i]! + (1 - k) * 24).toFixed(2)}px`;
        });
        wall.style.transform = drift > 0 ? `translateY(${(-drift * Math.max(0, t)).toFixed(2)}px)` : '';
      },
    };
  },
};
