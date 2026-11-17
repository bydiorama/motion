// scene/strip-cycle. See library/primitives/scene/strip-cycle.md.
//
// A frame cut into horizontal strips by a ruled grid. Pictures take turns filling
// it, and each change travels strip by strip: a field of colour runs ahead of the
// next picture through every strip, a step apart, so the grid itself carries the
// cut. The rules stay drawn over the pictures the whole time.
//
// The frame can begin or end on its bare ground (`empty`), so the same layer can
// open from the ruled ground and close back onto it, which is what makes a loop.
import { clamp } from '../../core/ease.ts';
import { staggerDelays } from '../../core/stagger.ts';
import { list, num, str, type Primitive, type PrimitiveIssue } from '../types.ts';

export const ORDERS = ['down', 'up', 'center', 'edges', 'random'] as const;
export const DIRECTIONS = ['left', 'right', 'alternate', 'weave'] as const;
export const EMPTY = ['none', 'start', 'end', 'both'] as const;

/** What the frame shows, in order: a picture's index, or null for the bare ground. */
export function statesOf(pictures: number, empty: string): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: pictures }, (_, i) => i);
  if (empty === 'start' || empty === 'both') out.unshift(null);
  if (empty === 'end' || empty === 'both') out.push(null);
  return out;
}

/** The most of a change the stagger may take: each strip still travels for at least 40% of it. */
const MAX_SPREAD = 0.6;

/**
 * How one change is clocked. `shift` is the whole change, first strip leaving to
 * last strip landing, so a change lasts exactly what the film says (a beat, two).
 * The stagger is spread inside it: each strip starts `delays[row]` in and travels
 * for `travel`. A stagger too wide for the change is scaled down to fit.
 */
export function stripClock(rows: number, shift: number, stagger: number, order: string, seed = 1): { delays: number[]; travel: number } {
  const raw = staggerDelays(rows, stagger, orderFrom(order), seed);
  const spread = Math.max(0, ...raw), room = MAX_SPREAD * shift;
  const k = spread > room ? room / spread : 1;
  return { delays: raw.map((d) => d * k), travel: shift - spread * k };
}

const orderFrom = (order: string): string => (order === 'down' ? 'start' : order === 'up' ? 'end' : order);

export interface StripTiming {
  /** When each change starts (change k leads into state k + 1). */
  changes: number[];
  /** Length of one change. */
  change: number;
  duration: number;
}

/**
 * Every state holds for its own time (`holds[s]`), then the next change runs. The
 * last state holds, then the layer ends. A number holds every state alike.
 */
export function stripTiming(states: number, holds: number | readonly number[], change: number): StripTiming {
  const n = Math.max(1, states);
  const h = (s: number) => (typeof holds === 'number' ? holds : holds[s] ?? holds[holds.length - 1] ?? 0);
  const changes: number[] = [];
  let t = 0;
  for (let k = 0; k < n - 1; k++) { t += h(k); changes.push(t); t += change; }
  return { changes, change, duration: t + h(n - 1) };
}

/** How long each state holds: pictures for `hold`, the bare ground for `ground` (0: as long as a picture). */
export const holdsOf = (states: readonly (number | null)[], hold: number, ground: number): number[] =>
  states.map((s) => (s === null && ground > 0 ? ground : hold));

/**
 * Which side the incoming picture enters strip `row` from in change `k`: +1 the
 * right edge, −1 the left. `direction` is the way the strips run, as for
 * transition/band-sweep: `left` runs leftward, so it enters from the right.
 * `alternate` turns every other strip; `weave` also turns the whole pattern each
 * change, so strips never repeat a side.
 */
export function sideOf(direction: string, row: number, k: number): 1 | -1 {
  if (direction === 'left') return 1;
  if (direction === 'right') return -1;
  const flip = direction === 'weave' ? row + k : row;
  return flip % 2 === 0 ? 1 : -1;
}

/**
 * Where one strip stands in change k at time t: `u` is the eased travel of the
 * incoming picture (0 not yet moving, 1 landed). Before the change the strip shows
 * state k; after it, state k + 1.
 */
export function stripAt(t: number, timing: StripTiming, delays: readonly number[], row: number, shift: number, ease: (x: number) => number):
  { from: number; to: number; u: number } {
  const d = delays[row] ?? 0;
  for (let k = 0; k < timing.changes.length; k++) {
    const start = timing.changes[k]! + d;
    if (t < start) return { from: k, to: k, u: 0 };
    if (t < start + shift) return { from: k, to: k + 1, u: ease(clamp((t - start) / shift)) };
  }
  const last = timing.changes.length;
  return { from: last, to: last, u: 0 };
}

export const stripCycle: Primitive = {
  slug: 'scene/strip-cycle',
  summary: 'Pictures change strip by strip across a ruled grid, each change led by a field of colour.',
  props: {
    images: { type: 'string[]', required: true, label: 'Pictures, in the order they fill the frame' },
    fills: { type: 'string[]', default: ['accent'], label: 'Colours that lead each change, in turn (surface names or CSS colours)' },
    rule: { type: 'string', default: 'var(--m-text-primary)', label: 'Colour of the rules' },
  },
  params: {
    rows: { type: 'number', default: 8, min: 2, max: 16, step: 1, unit: 'strips', label: 'Strips in the grid' },
    width: { type: 'number', default: 100, min: 20, max: 100, step: 1, unit: '% of stage', label: 'Frame width' },
    height: { type: 'number', default: 100, min: 20, max: 100, step: 1, unit: '% of stage', label: 'Frame height' },
    hold: { type: 'number', default: 1.2, min: 0.3, max: 6, step: 0.05, unit: 's', label: 'Time each picture stays whole' },
    ground_hold: { type: 'number', default: 0, min: 0, max: 6, step: 0.05, unit: 's', label: 'Time the bare ground holds at a start or end (0: as long as a picture)' },
    shift: { type: 'number', default: 1, min: 0.3, max: 2.5, step: 0.05, unit: 's', label: 'Time one change takes, first strip to last' },
    stagger: { type: 'number', default: 0.05, min: 0, max: 0.3, step: 0.01, unit: 's', label: 'Delay between strips' },
    order: { type: 'choice', default: 'down', options: ORDERS, label: 'Which strips change first' },
    direction: { type: 'choice', default: 'left', options: DIRECTIONS, label: 'Which way the strips run: left is forward, in the reading direction' },
    lead: { type: 'number', default: 0.35, min: 0, max: 1, step: 0.01, unit: '× frame width', label: 'Length of the colour field ahead of the picture' },
    drag: { type: 'number', default: 0.12, min: 0, max: 0.5, step: 0.01, unit: '× frame width', label: 'How far the leaving picture is pushed along' },
    push: { type: 'number', default: 1.06, min: 1, max: 1.3, step: 0.01, unit: '×', label: 'Scale a picture arrives at, settling to 1 while it is seen' },
    rule_width: { type: 'number', default: 2, min: 0, max: 12, step: 0.5, unit: 'px', label: 'Weight of the rules (0 for none)' },
    rule_opacity: { type: 'number', default: 0.6, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'Opacity of the rules' },
    edges: { type: 'boolean', default: false, label: 'Rule the top and bottom edges too' },
    empty: { type: 'choice', default: 'none', options: EMPTY, label: 'Begin and/or end on the bare ruled ground' },
    ease: { type: 'ease', default: 'quart.inOut', label: 'Curve of each strip' },
  },
  duration(props, p) {
    const states = statesOf(list(props.images).length, str(p.empty, 'none'));
    return stripTiming(states.length, holdsOf(states, num(p.hold, 1.2), num(p.ground_hold, 0)), num(p.shift, 1)).duration;
  },
  cues(props, p) {
    const states = statesOf(list(props.images).length, str(p.empty, 'none'));
    const t = stripTiming(states.length, holdsOf(states, num(p.hold, 1.2), num(p.ground_hold, 0)), num(p.shift, 1));
    return t.changes.map((at) => ({ at, length: t.change }));
  },
  check(props, p) {
    const issues: PrimitiveIssue[] = [];
    if (!list(props.images).length) issues.push({ path: 'props.images', message: 'The strips need at least one picture.', hint: 'Add picture paths to images.' });
    const states = statesOf(list(props.images).length, str(p.empty, 'none'));
    if (states.length < 2) issues.push({ path: 'props.images', message: 'With one picture and no empty ground, nothing ever changes.', hint: 'Add a picture, or set empty to start, end or both.' });
    return issues;
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [sw, sh] = ctx.size;
    const W = Math.round((sw * num(p.width, 100)) / 100), H = Math.round((sh * num(p.height, 100)) / 100);
    const rows = Math.round(num(p.rows, 8));
    const images = list(props.images);
    const fills = list(props.fills).length ? list(props.fills) : ['accent'];
    const states = statesOf(images.length, str(p.empty, 'none'));
    const shift = num(p.shift, 1), hold = num(p.hold, 1.2), lead = num(p.lead, 0.35), drag = num(p.drag, 0.12), push = num(p.push, 1.06);
    const order = str(p.order, 'down'), direction = str(p.direction, 'left');
    const { delays, travel } = stripClock(rows, shift, num(p.stagger, 0.05), order, ctx.seed);
    const timing = stripTiming(states.length, holdsOf(states, hold, num(p.ground_hold, 0)), shift);
    const ease = ctx.ease(p.ease as never);
    const fillOf = (v: string) => (['base', 'surface', 'sunken', 'accent', 'inverse'].includes(v) ? `var(--m-bg-${v})` : v);

    el.style.cssText += `;width:${W}px;height:${H}px;position:relative;overflow:hidden`;
    // Strip edges on whole pixels, so neighbouring strips meet without a seam.
    const edgesY = Array.from({ length: rows + 1 }, (_, r) => Math.round((r * H) / rows));

    // When each state is first and last on screen, for its slow settle.
    const seen = states.map((_, s) => {
      const from = s === 0 ? 0 : timing.changes[s - 1]!;
      const to = s === states.length - 1 ? timing.duration : timing.changes[s]! + timing.change;
      return [from, Math.max(from + 1e-6, to)] as const;
    });

    interface Pane { box: HTMLElement; img: HTMLImageElement | undefined; field: HTMLElement }
    const strips = edgesY.slice(0, -1).map((top, r) => {
      const h = edgesY[r + 1]! - top;
      const strip = doc.createElement('div');
      strip.style.cssText = `position:absolute;left:0;top:${top}px;width:${W}px;height:${h}px;overflow:hidden`;
      // One pane per state: a field of colour on each side (only the leading one is seen) and the picture's slice.
      const panes: Pane[] = states.map((state, s) => {
        const box = doc.createElement('div');
        box.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${h}px;visibility:hidden;will-change:transform`;
        const field = doc.createElement('div');
        const colour = fillOf(fills[(Math.max(0, s - 1)) % fills.length]!);
        field.style.cssText = `position:absolute;top:0;height:${h}px;width:${Math.ceil(W * lead) + 1}px;background:${colour}`;
        box.appendChild(field);
        let img: HTMLImageElement | undefined;
        if (state !== null) {
          const win = doc.createElement('div');
          win.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${h}px;overflow:hidden`;
          img = doc.createElement('img');
          img.src = images[state]!;
          img.alt = '';
          img.decoding = 'sync';
          // The whole frame's picture, shifted up so this strip shows its own slice.
          img.style.cssText = `position:absolute;left:0;top:${-top}px;width:${W}px;height:${H}px;object-fit:cover;transform-origin:${W / 2}px ${H / 2}px;max-width:none`;
          win.appendChild(img);
          box.appendChild(win);
        }
        strip.appendChild(box);
        return { box, img, field };
      });
      el.appendChild(strip);
      return { panes, h };
    });

    // Rules on top: they belong to the grid, not to any one picture.
    const rw = num(p.rule_width, 2);
    if (rw > 0) {
      const from = p.edges ? 0 : 1, to = p.edges ? rows : rows - 1;
      for (let r = from; r <= to; r++) {
        const y = Math.min(H - rw, Math.max(0, edgesY[r]! - rw / 2));
        const rule = doc.createElement('div');
        rule.style.cssText = `position:absolute;left:0;top:${y}px;width:${W}px;height:${rw}px;background:${str(props.rule, 'var(--m-text-primary)')};opacity:${num(p.rule_opacity, 0.6)};pointer-events:none`;
        el.appendChild(rule);
      }
    }

    const fw = Math.ceil(W * lead) + 1;
    /** Shows a pane at x; `clip` hides what lies past the incoming picture's leading edge (its own px). */
    const place = (pane: Pane, x: number, side: 1 | -1, t: number, s: number, clip = '', leading = false) => {
      pane.box.style.visibility = 'inherit';
      // Only the incoming picture's field is ever seen; at rest it would show as a sliver at the edge.
      pane.field.style.visibility = leading ? 'inherit' : 'hidden';
      pane.box.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      pane.box.style.clipPath = clip;
      // The field sits on the leading side: to the left of a picture coming from the right.
      pane.field.style.left = side === 1 ? `${-fw + 1}px` : `${W - 1}px`;
      if (pane.img) {
        const [a, b] = seen[s]!;
        const k = clamp((t - a) / (b - a));
        pane.img.style.transform = `scale(${(push + (1 - push) * k).toFixed(5)})`;
      }
    };

    return {
      seek(t) {
        strips.forEach(({ panes }, r) => {
          const { from, to, u } = stripAt(t, timing, delays, r, travel, ease);
          panes.forEach((pane) => { pane.box.style.visibility = 'hidden'; });
          if (from === to) { place(panes[from]!, 0, 1, t, from); return; }
          const side = sideOf(direction, r, from);
          // The incoming pane travels its own width plus its field; the leaving one is pushed a little the same way.
          const reach = W * (1 + lead);
          const xin = side * reach * (1 - u), xout = -side * drag * W * u;
          // The leaving picture ends at the incoming field's leading edge, so the bare ground can follow a field too.
          const cut = side === 1 ? Math.max(0, xout + W - (xin - fw + 1)) : Math.max(0, xin + W + fw - 1 - xout);
          place(panes[from]!, xout, side, t, from, side === 1 ? `inset(0 ${cut.toFixed(2)}px 0 -${fw}px)` : `inset(0 -${fw}px 0 ${cut.toFixed(2)}px)`);
          place(panes[to]!, xin, side, t, to, '', true);
        });
      },
    };
  },
};
