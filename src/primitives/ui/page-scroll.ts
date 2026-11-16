// ui/page-scroll. See library/primitives/ui/page-scroll.md.
//
// A page seen through a window, scrolled the way a person reads it: it travels,
// rests on a section, travels again. The page is one tall capture or its
// sections stacked. It smears along the scroll only, by its speed.
import { clamp } from '../../core/ease.ts';
import { directionalBlur, streak } from '../blur.ts';
import { list, num, nums, str, type Primitive } from '../types.ts';

export interface ScrollPlan { from: number; to: number; stops: number[]; duration: number; rest: number; delay: number }

/**
 * How the scroll's travelling time is shared between its legs. A leg four times as long takes twice
 * as long: a long leg is faster, as a hand scrolls, but never a flash next to a short one.
 */
export function legTimes(marks: number[], travel: number): number[] {
  const weights = marks.slice(1).map((m, i) => Math.sqrt(Math.abs(m - marks[i]!)));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (sum > 0 ? (travel * w) / sum : travel / weights.length));
}

/** Share of the scrollable height (0–100) the page has travelled t seconds in. Eased leg by leg, resting at each stop. */
export function scrollAt(t: number, p: ScrollPlan, ease: (x: number) => number): number {
  const marks = [p.from, ...p.stops, p.to];
  const legs = marks.length - 1;
  const rest = legs > 1 ? Math.min(p.rest, (p.duration * 0.5) / (legs - 1)) : 0;
  const times = legTimes(marks, p.duration - rest * (legs - 1));
  let u = t - p.delay;
  if (u <= 0) return marks[0]!;
  for (let i = 0; i < legs; i++) {
    const leg = times[i]!;
    if (u < leg) return marks[i]! + (marks[i + 1]! - marks[i]!) * ease(clamp(u / leg));
    u -= leg;
    if (i < legs - 1) { if (u < rest) return marks[i + 1]!; u -= rest; }
  }
  return marks[legs]!;
}

const plan = (props: Record<string, unknown>, p: Record<string, unknown>): ScrollPlan => ({
  from: num(p.from), to: num(p.to, 100), stops: nums(props.stops), duration: num(p.duration, 3), rest: num(p.rest, 0.4), delay: num(p.delay),
});

/** Room above and below the window for the smear to fall off in, out of sight. */
const MARGIN = 150;

export const pageScroll: Primitive = {
  slug: 'ui/page-scroll',
  summary: 'A page scrolls inside a window, resting on its sections, blurred only by its own speed.',
  props: {
    srcs: { type: 'string[]', required: true, label: 'The page: one tall capture, or its sections from top to bottom' },
    alt: { type: 'string', default: '', label: 'Description of the page' },
    stops: { type: 'number[]', default: [], label: 'Where the scroll rests on the way, in % of the scrollable height' },
  },
  params: {
    width: { type: 'number', default: 640, min: 1, max: 4000, step: 1, unit: 'px', label: 'Window width' },
    height: { type: 'number', default: 800, min: 1, max: 4000, step: 1, unit: 'px', label: 'Window height' },
    radius: { type: 'number', default: 16, min: 0, max: 400, step: 1, unit: 'px', label: 'Corner radius' },
    from: { type: 'number', default: 0, min: 0, max: 100, step: 0.5, unit: '% of scroll', label: 'Where the scroll starts' },
    to: { type: 'number', default: 100, min: 0, max: 100, step: 0.5, unit: '% of scroll', label: 'Where the scroll ends' },
    duration: { type: 'number', default: 3, min: 0.4, max: 30, step: 0.05, unit: 's', label: 'Length of the scroll, rests included' },
    rest: { type: 'number', default: 0.4, min: 0, max: 3, step: 0.05, unit: 's', label: 'Time resting at each stop' },
    delay: { type: 'number', default: 0, min: 0, max: 30, step: 0.05, unit: 's', label: 'Time held at the start before it scrolls' },
    ease: { type: 'ease', default: 'sine.inOut', label: 'Curve of each leg' },
    shutter: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'Motion blur: share of a frame the scroll smears over' },
  },
  duration: (props, p) => { const s = plan(props, p); return s.delay + s.duration; },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument, w = num(p.width), h = num(p.height);
    // The engine places `el`, so the window that positions the page is a child of it.
    el.style.cssText += `;width:${w}px;height:${h}px;border-radius:${num(p.radius)}px;overflow:hidden`;
    const win = doc.createElement('div');
    win.style.cssText = `position:relative;width:${w}px;height:${h}px`;
    // The smear is drawn on a taller pane behind the window, so its soft ends are cut off by the window.
    const pane = doc.createElement('div');
    pane.style.cssText = `position:absolute;left:0;top:${-MARGIN}px;width:${w}px;height:${h + 2 * MARGIN}px;overflow:hidden`;
    const page = doc.createElement('div');
    page.style.cssText = `position:absolute;left:0;top:${MARGIN}px;width:${w}px;will-change:transform`;
    list(props.srcs).forEach((src, i) => {
      const img = doc.createElement('img');
      img.src = src;
      img.alt = i === 0 ? str(props.alt) : '';
      img.decoding = 'sync';
      img.style.cssText = 'display:block;width:100%;height:auto';
      page.appendChild(img);
    });
    pane.appendChild(page);
    win.appendChild(pane);
    el.appendChild(win);
    const s = plan(props, p), ease = ctx.ease(p.ease as never), shutter = num(p.shutter, 0.5), half = 0.5 / ctx.fps;
    return {
      seek(t) {
        const range = Math.max(0, page.offsetHeight - h);
        const y = (at: number) => (scrollAt(at, s, ease) / 100) * range;
        page.style.transform = `translateY(${(-y(t)).toFixed(2)}px)`;
        pane.style.filter = directionalBlur(pane, 0, streak(y(t + half) - y(t - half), shutter));
      },
    };
  },
};
