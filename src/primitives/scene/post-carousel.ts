// scene/post-carousel. See library/primitives/scene/post-carousel.md.
//
// A run of slides shown one at a time, as a social post or as bare posters.
// The slides stand side by side in one world: the one in front faces the
// camera, its neighbours stand beside it turned away, hinged on the edge
// nearest the frame, so they show as narrow strips. Each step, the row turns:
// the front slide swings out to one side as the next swings in from the other.
// With chrome, a post's header and footer stay put above and below while the
// slides turn between them; dots in the footer follow the slide in front.
// Pictures drift inside their slide while they can be seen.
import { clamp, lerp } from '../../core/ease.ts';
import { fillItem } from './bento-grid.ts';
import { list, num, str, type Primitive, type PrimitiveIssue } from '../types.ts';

export const RATIOS = ['4:5', '1:1', '9:16', '3:4', '16:9'] as const;
const ratioOf = (r: unknown): number => {
  const [a, b] = str(r, '4:5').split(':').map(Number);
  return a! > 0 && b! > 0 ? a! / b! : 0.8;
};
/** Header and footer of a post, each as a share of its width. */
const BAR = 0.14;
const PUSH = 0.05;

/**
 * Where the row stands at t: 0 is the first slide in front, 1 the second, and
 * so on, easing between them. A loop turns on from the last slide to the first,
 * reaching n (= 0 again) at the end of its last step.
 */
export function rowAt(t: number, n: number, hold: number, turn: number, loop: boolean, ease: (x: number) => number = (x) => x): number {
  if (n < 2 || t < hold) return 0;
  const P = hold + turn, steps = loop ? n : n - 1;
  const m = Math.min(steps - 1, Math.floor((t - hold) / P));
  return m + ease(clamp((t - hold - m * P) / turn));
}

/** Slide i's place relative to the front at row position c: 0 in front, 1 beside on the right, −1 on the left. */
export function placeOf(i: number, c: number, n: number, loop: boolean): number {
  const d = i - c;
  if (!loop || n < 3) return d;
  // Around the loop: the shortest way, so the first slide waits on the right of the last.
  return ((((d + n / 2) % n) + n) % n) - n / 2;
}

export const postCarousel: Primitive = {
  slug: 'scene/post-carousel',
  summary: 'Slides shown one at a time as a post or posters, turning past in depth.',
  props: {
    slides: { type: 'string[]', required: true, label: 'The slides, in order: markup or a picture path each' },
    handle: { type: 'string', default: 'yourbrand', label: 'Account name in the post header' },
    avatar: { type: 'string', default: '', label: 'Picture for the avatar. Left out: the handle’s first letter on the accent' },
  },
  params: {
    width: { type: 'number', default: 54, min: 20, max: 100, step: 1, unit: '% of stage width', label: 'Width of a slide (made smaller if the post would not fit the stage height)' },
    ratio: { type: 'choice', default: '4:5', options: RATIOS, label: 'Shape of a slide, width : height' },
    chrome: { type: 'choice', default: 'post', options: ['post', 'none'], label: 'post: a header and footer frame the slides; none: bare posters' },
    hold: { type: 'number', default: 1.4, min: 0.4, max: 6, step: 0.05, unit: 's', label: 'How long each slide rests in front' },
    turn: { type: 'number', default: 0.8, min: 0.3, max: 2, step: 0.05, unit: 's', label: 'Length of one turn to the next slide' },
    angle: { type: 'number', default: 72, min: 0, max: 85, step: 1, unit: 'deg', label: 'How far the neighbours are turned away; 0 lays them flat beside the frame' },
    loop: { type: 'boolean', default: false, label: 'Turn on from the last slide back to the first, so the film can loop' },
  },
  duration(props, p) {
    const n = list(props.slides).length, hold = num(p.hold), P = hold + num(p.turn);
    if (n < 2) return hold;
    return p.loop === true ? n * P : hold + (n - 1) * P;
  },
  cues(props, p) {
    const n = list(props.slides).length, hold = num(p.hold), turn = num(p.turn);
    const steps = n < 2 ? 0 : p.loop === true ? n : n - 1;
    return Array.from({ length: steps }, (_, m) => ({ at: hold + m * (hold + turn), length: turn }));
  },
  check(props, p) {
    const issues: PrimitiveIssue[] = [];
    const n = list(props.slides).length;
    if (n < 1) issues.push({ path: 'props.slides', message: 'There are no slides.', hint: 'Give at least two: one alone has nothing to turn to.' });
    if (p.loop === true && n > 0 && n < 3) issues.push({ path: 'params.loop', message: `A loop of ${n} slide${n === 1 ? '' : 's'} has no slide waiting on each side.`, hint: 'Give three slides or more, or set loop to false.' });
    return issues;
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [W, H] = ctx.size;
    const slides = list(props.slides), n = slides.length;
    const chrome = str(p.chrome) !== 'none', ratio = ratioOf(p.ratio), loop = p.loop === true;
    // A slide is `width` of the stage, or smaller so the whole post fits 92% of the stage height.
    const bars = chrome ? 2 * BAR : 0;
    const w = Math.min((num(p.width) / 100) * W, (0.92 * H) / (1 / ratio + bars));
    const h = w / ratio, bar = chrome ? BAR * w : 0, gap = 0.035 * w, R = 0.035 * w, u = w / 1000;
    const hold = num(p.hold), turn = Math.max(0.01, num(p.turn)), P = hold + turn, angle = num(p.angle);
    const ease = ctx.ease(ctx.tokens.ease_move);

    const wrap = doc.createElement('div');
    wrap.style.cssText = `position:relative;width:${w}px;height:${h + 2 * bar}px;text-align:left`;
    const row = doc.createElement('div');
    row.style.cssText = `position:absolute;left:0;top:${bar}px;width:${w}px;height:${h}px;perspective:${(2.5 * w).toFixed(0)}px;transform-style:preserve-3d`;
    const cards = slides.map((s) => {
      const card = doc.createElement('div');
      // Bare posters take the stage's card radius and shadow when it sets them (--m-card-radius, --m-card-shadow).
      card.style.cssText = `position:absolute;inset:0;overflow:hidden;background:var(--m-bg-surface);border-radius:${chrome ? '0' : `var(--m-card-radius, ${R}px)`};`
        + `backface-visibility:hidden;font-size:${(64 * u).toFixed(2)}px;box-shadow:var(--m-card-shadow, 0 ${24 * u}px ${60 * u}px rgba(0,0,0,.28))`;
      const inner = doc.createElement('div');
      inner.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;transform-origin:50% 50%';
      fillItem(inner, s);
      card.appendChild(inner);
      row.appendChild(card);
      return { card, inner };
    });
    wrap.appendChild(row);

    const dots: HTMLElement[] = [];
    if (chrome) {
      const font = 'var(--m-font-body)';
      const barCss = (top: number, corners: string) => `position:absolute;left:0;top:${top}px;width:${w}px;height:${bar}px;box-sizing:border-box;`
        + `display:flex;align-items:center;gap:${22 * u}px;padding:0 ${36 * u}px;background:var(--m-bg-surface);color:var(--m-text-primary);`
        + `border-radius:${corners};font:600 ${34 * u}px/1 ${font}`;
      const head = doc.createElement('div');
      head.style.cssText = barCss(0, `${R}px ${R}px 0 0`) + `;box-shadow:inset 0 -1px 0 color-mix(in srgb, var(--m-text-primary) 8%, transparent)`;
      const av = doc.createElement('div');
      const size = 64 * u;
      av.style.cssText = `flex:none;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;position:relative;display:grid;place-items:center;`
        + `background:var(--m-accent);color:var(--m-text-on-accent);font:700 ${30 * u}px/1 ${font}`;
      const avatar = str(props.avatar);
      if (avatar) fillItem(av, avatar);
      else av.textContent = (str(props.handle, 'y').trim()[0] ?? 'y').toUpperCase();
      const name = doc.createElement('span');
      name.textContent = str(props.handle, 'yourbrand');
      name.style.cssText = 'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      const more = doc.createElement('span');
      more.textContent = '•••';
      more.style.cssText = `letter-spacing:${2 * u}px;font-size:${22 * u}px;color:var(--m-text-muted)`;
      head.append(av, name, more);

      const foot = doc.createElement('div');
      foot.style.cssText = barCss(bar + h, `0 0 ${R}px ${R}px`) + `;box-shadow:inset 0 1px 0 color-mix(in srgb, var(--m-text-primary) 8%, transparent)`;
      const icon = (d: string, fill = 'none') => {
        const s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('viewBox', '0 0 24 24');
        s.setAttribute('width', String(50 * u));
        s.setAttribute('height', String(50 * u));
        s.style.cssText = 'flex:none;display:block';
        s.innerHTML = `<path d="${d}" fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
        return s;
      };
      const heart = icon('M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z', 'currentColor');
      heart.style.color = 'var(--m-accent)';
      const bubble = icon('M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z');
      const send = icon('M21 3 10 13.5M21 3l-6.5 18-4.5-7.5L3 9.5 21 3Z');
      const pager = doc.createElement('div');
      pager.style.cssText = `flex:1;display:flex;justify-content:center;gap:${10 * u}px`;
      for (let i = 0; i < Math.min(n, 12); i++) {
        const dot = doc.createElement('i');
        dot.style.cssText = `display:block;width:${11 * u}px;height:${11 * u}px;border-radius:50%;background:var(--m-text-primary)`;
        pager.appendChild(dot);
        dots.push(dot);
      }
      const save = icon('M6 3.5h12v17l-6-4.5-6 4.5v-17Z');
      foot.append(heart, bubble, send, pager, save);
      wrap.append(head, foot);
    }
    el.appendChild(wrap);

    // When each slide starts to come to the front (the first is there from the start).
    const arrives = (i: number) => (i === 0 ? -turn : hold + (i - 1) * P);
    const L = n * P;
    return {
      seek(t) {
        const c = rowAt(t, n, hold, turn, loop, ease);
        cards.forEach(({ card, inner }, i) => {
          const d = placeOf(i, c, n, loop);
          const a = clamp(d, -1, 1), far = Math.max(0, Math.abs(d) - 1);
          // Hinged on the edge nearest the frame, so a neighbour's near edge stays a gap from it.
          card.style.transformOrigin = d >= 0 ? '0% 50%' : '100% 50%';
          // Beyond the neighbours, slides wait far behind them, so the slide turning to the
          // front never passes behind one, and fade in over the end of the turn that makes
          // them a neighbour.
          card.style.transform = `translateX(${(a * (w + gap)).toFixed(2)}px) translateZ(${(-(Math.abs(a) * 0.06 + far * 1.5) * w).toFixed(2)}px) rotateY(${(angle * a).toFixed(3)}deg)`;
          card.style.opacity = far > 0 ? clamp((0.6 - far) / 0.6).toFixed(4) : '';
          card.style.visibility = far < 1 ? 'inherit' : 'hidden';
          card.style.zIndex = String(10 - Math.round(Math.abs(d) * 2));
          // Linear drift from the moment it starts to arrive until it has gone.
          const since = loop ? ((((t - arrives(i)) % L) + L) % L) : t - arrives(i);
          inner.style.transform = `scale(${(1 + PUSH * (1 - clamp(since / (P + turn)))).toFixed(4)})`;
        });
        dots.forEach((dot, i) => {
          const near = Math.max(0, 1 - Math.abs(placeOf(i, c, n, loop)));
          dot.style.opacity = lerp(0.22, 1, near).toFixed(3);
        });
      },
    };
  },
};
