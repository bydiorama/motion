// transition/signal-wipe. See library/primitives/transition/signal-wipe.md.
//
// A line of accent light crosses the frame and leaves the next scene behind it,
// with a soft wash of the same light trailing on the revealed side. The content
// on both sides stays still; only the edge moves, so it reads as a cut drawn by
// light. The line exists only while it crosses.
import { clamp } from '../../core/ease.ts';
import { num, str, type TransitionPrimitive } from '../types.ts';

type Dir = 'down' | 'up' | 'right' | 'left';
const lines = new WeakMap<HTMLElement, HTMLElement>();

export const signalWipe: TransitionPrimitive = {
  slug: 'transition/signal-wipe',
  summary: 'A glowing accent line sweeps across and leaves the next scene behind it.',
  duration: 0.55,
  calm: { glow: 0.5, push: 0.01 },
  params: {
    duration: { type: 'number', default: 0.55, min: 0.35, max: 1.2, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    direction: { type: 'choice', default: 'down', options: ['down', 'up', 'right', 'left'], label: 'Which way the line travels' },
    glow: { type: 'number', default: 1, min: 0, max: 2, step: 0.05, unit: 'ratio', label: 'Strength of the glow and its trailing wash' },
    trail: { type: 'number', default: 0.16, min: 0, max: 0.4, step: 0.01, unit: 'of the frame', label: 'Length of the wash behind the line' },
    push: { type: 'number', default: 0.04, min: 0, max: 0.1, step: 0.005, unit: 'ratio', label: 'How much the outgoing scene grows as it is covered' },
  },
  apply(from, to, k, p, ctx) {
    const [W, H] = ctx.size, dir = (str(p.direction) || 'down') as Dir;
    const e = ctx.ease('quint.inOut')(clamp(k));
    const vertical = dir === 'down' || dir === 'up';
    const span = vertical ? H : W;
    // The edge starts and ends just outside the frame, so the glow is never cut at rest.
    const pad = 30, pos = -pad + e * (span + 2 * pad);
    const covered = clamp(pos, 0, span);
    const inset = { down: `0 0 ${span - covered}px 0`, up: `${span - covered}px 0 0 0`, right: `0 ${span - covered}px 0 0`, left: `0 0 0 ${span - covered}px` }[dir];
    to.style.clipPath = covered >= span ? '' : `inset(${inset})`;
    from.style.transformOrigin = '50% 50%';
    from.style.transform = `scale(${(1 + num(p.push) * e).toFixed(4)})`;

    // The line and its wash sit over both scenes, in the stage.
    const stage = to.parentElement;
    if (!stage) return;
    let line = lines.get(to);
    if (!line) {
      line = to.ownerDocument.createElement('div');
      line.className = 'm-signal-line';
      const wash = to.ownerDocument.createElement('div');
      line.appendChild(wash);
      stage.appendChild(line);
      lines.set(to, line);
    }
    const g = num(p.glow), trail = num(p.trail) * span;
    const along = (dir === 'down' || dir === 'right') ? pos : span - pos;
    // The wash lies on the side already revealed: behind the line's travel.
    const towards = { down: 'to top', up: 'to bottom', right: 'to left', left: 'to right' }[dir];
    const wash = line.firstElementChild as HTMLElement;
    line.style.cssText = `position:absolute;z-index:999;pointer-events:none;background:color-mix(in srgb, var(--m-accent) 70%, white);`
      + (vertical ? `left:0;right:0;height:2px;top:${(along - 1).toFixed(2)}px;` : `top:0;bottom:0;width:2px;left:${(along - 1).toFixed(2)}px;`)
      + `box-shadow:0 0 ${22 * g}px ${5 * g}px color-mix(in srgb, var(--m-accent) ${Math.round(55 * Math.min(1, g))}%, transparent),0 0 4px 1px color-mix(in srgb, var(--m-accent) 40%, white);`
      + `opacity:${k <= 0 || k >= 1 ? 0 : 1}`;
    wash.style.cssText = `position:absolute;${vertical ? `left:0;right:0;height:${trail}px;` : `top:0;bottom:0;width:${trail}px;`}`
      + ({ down: 'bottom:2px;', up: 'top:2px;', right: 'right:2px;', left: 'left:2px;' }[dir])
      + `background:linear-gradient(${towards}, color-mix(in srgb, var(--m-accent) ${Math.round(16 * g)}%, transparent), transparent)`;
  },
  clear(el) {
    el.style.clipPath = '';
    el.style.transform = '';
    el.style.transformOrigin = '';
    lines.get(el)?.remove();
    lines.delete(el);
  },
};
