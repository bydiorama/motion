// fx/pan-across. See library/primitives/fx/pan-across.md.
//
// A picture far wider (or taller) than its frame fills the frame the other way and
// the camera travels along it: a 16:9 billboard read across a 9:16 phone. The
// primitive knows the picture's ratio, so the pace check can tell how fast the
// picture crosses the screen at its fastest, and warn before it strobes.
import { clamp, resolveEase, type EaseSpec } from '../../core/ease.ts';
import { num, str, type Primitive } from '../types.ts';

export interface PanGeometry {
  /** Which way the picture travels. */
  axis: 'x' | 'y';
  /** Picture size on stage, px. */
  w: number;
  h: number;
  /** How much of the picture lies outside the frame along the travel, px. */
  spare: number;
}

/** The picture fills the frame across the travel and runs past it along it. */
export function panGeometry(frame: [number, number], aspect: number, scale = 1): PanGeometry {
  const [fw, fh] = frame, a = Math.max(0.01, aspect), s = Math.max(1, scale);
  if (a >= fw / fh) {
    const h = fh * s, w = h * a;
    return { axis: 'x', w, h, spare: Math.max(0, w - fw) };
  }
  const w = fw * s, h = w / a;
  return { axis: 'y', w, h, spare: Math.max(0, h - fh) };
}

/** Steepest slope of an ease, 1 for linear, π/2 for sine.inOut. */
export function peakSlope(ease: (x: number) => number, samples = 200): number {
  let peak = 0;
  for (let i = 0; i < samples; i++) peak = Math.max(peak, Math.abs(ease((i + 1) / samples) - ease(i / samples)) * samples);
  return peak;
}

/** Fastest the picture moves on stage, px a second. */
export function panSpeed(geo: PanGeometry, from: number, to: number, duration: number, ease: (x: number) => number): number {
  return ((Math.abs(to - from) / 100) * geo.spare * peakSlope(ease)) / Math.max(0.01, duration);
}

const frameOf = (p: Record<string, unknown>, size: [number, number]): [number, number] => [num(p.width) || size[0], num(p.height) || size[1]];

export const panAcross: Primitive = {
  slug: 'fx/pan-across',
  summary: 'The camera travels along a picture wider or taller than its frame.',
  props: {
    src: { type: 'string', required: true, label: 'Image path or URL' },
    alt: { type: 'string', default: '', label: 'Description of the picture' },
  },
  params: {
    width: { type: 'number', default: 0, min: 0, max: 4000, step: 1, unit: 'px', label: 'Frame width; 0 is the stage' },
    height: { type: 'number', default: 0, min: 0, max: 4000, step: 1, unit: 'px', label: 'Frame height; 0 is the stage' },
    aspect: { type: 'number', default: 1.78, min: 0.2, max: 6, step: 0.01, unit: 'w ÷ h', label: "The picture's width over its height" },
    from: { type: 'number', default: 20, min: 0, max: 100, step: 1, unit: '% of travel', label: 'Where the view starts: 0 one end of the picture, 100 the other' },
    to: { type: 'number', default: 80, min: 0, max: 100, step: 1, unit: '% of travel', label: 'Where the view ends' },
    scale: { type: 'number', default: 1, min: 1, max: 1.3, step: 0.01, unit: '×', label: 'Extra size, to leave room across the travel' },
    duration: { type: 'number', default: 4, min: 0.5, max: 30, step: 0.1, unit: 's', label: 'Length of the travel' },
    ease: { type: 'ease', default: 'sine.inOut', label: 'Curve of the travel: sine.inOut starts and settles like a camera' },
  },
  // Camera drift, not a change of picture: the pace check reads it as drift.
  cues: () => [],
  duration: (_props, p) => num(p.duration, 4),
  speed(_props, p, ctx) {
    const geo = panGeometry(frameOf(p, ctx.size), num(p.aspect, 1.78), num(p.scale, 1));
    return panSpeed(geo, num(p.from, 20), num(p.to, 80), num(p.duration, 4), resolveEase(p.ease as EaseSpec | undefined ?? 'sine.inOut'));
  },
  build(el, props, p, ctx) {
    const [fw, fh] = frameOf(p, ctx.size);
    const geo = panGeometry([fw, fh], num(p.aspect, 1.78), num(p.scale, 1));
    const img = el.ownerDocument.createElement('img');
    img.src = str(props.src);
    img.alt = str(props.alt);
    img.decoding = 'sync';
    el.style.cssText += `;position:relative;width:${fw}px;height:${fh}px;overflow:hidden`;
    // Centred across the travel; along it, placed by seek.
    const across = geo.axis === 'x' ? (fh - geo.h) / 2 : (fw - geo.w) / 2;
    img.style.cssText = `position:absolute;left:0;top:0;display:block;width:${geo.w}px;height:${geo.h}px;object-fit:cover;max-width:none;will-change:transform`;
    el.appendChild(img);
    const ease = ctx.ease(p.ease as never), d = num(p.duration, 4), from = num(p.from, 20), to = num(p.to, 80);
    return {
      seek(t) {
        const along = -geo.spare * ((from + (to - from) * ease(clamp(t / d))) / 100);
        const [x, y] = geo.axis === 'x' ? [along, across] : [across, along];
        img.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0)`;
      },
    };
  },
};
