// transition/band-sweep. See library/primitives/transition/band-sweep.md.
//
// Bands of colour run across the frame at slightly different angles, like
// ribbons thrown over it. Each one streams in along its own length, a step after
// the last, and swells as it goes until together they cover the frame; the cut
// happens under them. Then they run on out the far side, narrowing, and leave the
// next scene behind.
//
// Colours come from `--m-band-1` … `--m-band-6` when the film sets them (an
// identity's own palette), else from the stage's accent, inverse and surfaces.
import { clamp } from '../../core/ease.ts';
import { num, str, type TransitionPrimitive } from '../types.ts';
import { clearOverlays, overlay } from './overlay.ts';

const KEY = 'bands';
const FALLBACK = ['var(--m-bg-accent)', 'var(--m-bg-inverse)', 'var(--m-bg-surface)', 'var(--m-bg-sunken)'];
export const bandColour = (i: number): string => `var(--m-band-${(i % 6) + 1}, ${FALLBACK[i % FALLBACK.length]})`;

/** Each band's tilt, in degrees: alternating sides, shrinking towards the middle, never two the same. */
export function bandAngles(n: number, angle: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const share = 1 - (0.55 * ((i * 7) % n)) / Math.max(1, n);
    return side * angle * share;
  });
}

/**
 * How thick a band must be at its widest so that n of them, centred an even step
 * apart across `across` px and tilted by up to `angle`, leave no gap over `along` px.
 * Flat bands (angle 0) are exactly a step thick, plus a pixel against seams, so
 * their edges fall on the rows of a grid of n (or a multiple of n) rows.
 */
export function coverThickness(n: number, across: number, along: number, angle: number): number {
  const step = across / Math.max(1, n);
  if (angle === 0) return step + 1;
  const tilt = Math.tan((Math.abs(angle) * 2 * Math.PI) / 180) * along * 0.5;
  return step + tilt + step * 0.2;
}

/**
 * Where band i is at progress k: `lead` and `trail` are how far its leading and
 * trailing ends have travelled (0 to 1), `swell` how far it has grown from thin
 * to covering. Every band is fully across and fully grown at k = 0.5.
 */
export function bandAt(k: number, i: number, n: number, lag: number, ease: (x: number) => number): { lead: number; trail: number; swell: number } {
  const win = Math.max(0.05, 0.5 - (n - 1) * lag);
  const lead = ease(clamp((k - i * lag) / win));
  const trail = ease(clamp((k - 0.5 - i * lag) / win));
  // Grow late on the way in, shrink early on the way out, so the bands read as ribbons before they read as a wall.
  const swell = Math.min(clamp((k - i * lag - win * 0.35) / (0.5 - i * lag - win * 0.35)), 1 - clamp((k - 0.5) / (win * 0.65)));
  return { lead, trail, swell: ease(clamp(swell)) };
}

export const bandSweep: TransitionPrimitive = {
  slug: 'transition/band-sweep',
  summary: 'Bands of colour run across the frame at angles, swell to cover the cut, then run on.',
  duration: 1,
  calm: { angle: 6, lag: 0.03 },
  params: {
    duration: { type: 'number', default: 1, min: 0.5, max: 2, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    direction: { type: 'choice', default: 'left', options: ['left', 'right', 'up', 'down'], label: 'Which way the bands run' },
    bands: { type: 'number', default: 5, min: 2, max: 8, step: 1, unit: 'bands', label: 'Bands across the frame' },
    width: { type: 'number', default: 9, min: 2, max: 30, step: 0.5, unit: '% of frame', label: 'Thickness of a band as it enters' },
    angle: { type: 'number', default: 14, min: 0, max: 30, step: 0.5, unit: 'deg', label: 'Largest tilt of a band' },
    lag: { type: 'number', default: 0.05, min: 0, max: 0.09, step: 0.005, unit: 'ratio', label: 'How far each band trails the one before' },
  },
  apply(from, to, k, p, ctx) {
    const n = Math.max(2, Math.round(num(p.bands, 5)));
    const lag = Math.min(num(p.lag, 0.05), 0.45 / (n - 1));
    const dir = str(p.direction, 'left');
    const [W, H] = ctx.size;
    const horizontal = dir === 'left' || dir === 'right';
    // Bands run along the travel; they are stacked across it.
    const along = horizontal ? W : H, across = horizontal ? H : W;
    const angles = bandAngles(n, num(p.angle, 14));
    const thin = (num(p.width, 9) / 100) * Math.min(W, H);
    const full = Math.max(thin, coverThickness(n, across, along, num(p.angle, 14)));
    const length = Math.hypot(W, H) * 1.25;
    const ease = ctx.ease('quart.inOut');
    const sign = dir === 'left' || dir === 'up' ? -1 : 1;
    const bands = overlay(from, KEY, n);
    bands.forEach((el, i) => {
      const { lead, trail, swell } = bandAt(k, i, n, lag, ease);
      const thick = thin + (full - thin) * swell;
      // Centre of band i across the frame, and the band laid along the travel through it.
      const c = ((i + 0.5) / n) * across;
      const cx = horizontal ? W / 2 : c, cy = horizontal ? c : H / 2;
      const rot = (horizontal ? 0 : 90) + angles[i]!;
      el.style.background = bandColour(i);
      el.style.inset = 'auto';
      el.style.left = `${(cx - length / 2).toFixed(2)}px`;
      el.style.top = `${(cy - thick / 2).toFixed(2)}px`;
      el.style.width = `${length.toFixed(2)}px`;
      el.style.height = `${thick.toFixed(2)}px`;
      // Running in the band's own frame: the leading end enters from the far side, the trailing end follows it out.
      const front = lead * 100, back = trail * 100;
      el.style.clipPath = sign < 0 ? `inset(0 ${back.toFixed(3)}% 0 ${(100 - front).toFixed(3)}%)` : `inset(0 ${(100 - front).toFixed(3)}% 0 ${back.toFixed(3)}%)`;
      el.style.transform = `rotate(${rot.toFixed(3)}deg)`;
      el.style.visibility = lead <= 0 || trail >= 1 ? 'hidden' : 'visible';
    });
    // The cut happens under the bands, when all of them are across and grown.
    const cut = k >= 0.5;
    from.style.opacity = cut ? '0' : '1';
    to.style.opacity = cut ? '1' : '0';
    const settle = ease(clamp((k - 0.5) / 0.5));
    to.style.transform = cut ? `scale(${(1.03 - 0.03 * settle).toFixed(4)})` : '';
    from.style.transform = cut ? '' : `scale(${(1 + 0.02 * ease(clamp(k / 0.5))).toFixed(4)})`;
  },
  clear(el) {
    clearOverlays(el, KEY);
    el.style.transform = '';
    el.style.opacity = '';
  },
};
