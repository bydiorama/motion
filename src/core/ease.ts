// Easing. Every curve is a pure function of progress or of elapsed seconds, so a
// film can be drawn at any time, in any order.

export const clamp = (x: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

export type Bezier = readonly [number, number, number, number];
export interface SpringSpec {
  /** Seconds until the move first looks finished. */
  duration: number;
  /** 0 = no overshoot, 0.5 = lively. */
  bounce?: number;
}
/** How long a move eased by a spring should last, so the overshoot has time to settle. */
export const springSpan = (s: SpringSpec): number => s.duration * (1 + 2 * (s.bounce ?? 0));
/** A named curve, a cubic-bezier, or a spring. */
export type EaseSpec = string | Bezier | { spring: SpringSpec };

/** Solves a CSS cubic-bezier for x, the same curve the browser would draw. */
export function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const fx = (u: number) => ((ax * u + bx) * u + cx) * u;
  const fy = (u: number) => ((ay * u + by) * u + cy) * u;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const d = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(d) < 1e-6) break;
      u -= (fx(u) - x) / d;
    }
    // Newton can leave the unit interval on steep curves; bisect to be safe.
    if (u < 0 || u > 1 || Math.abs(fx(u) - x) > 1e-4) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 24; i++) {
        u = (lo + hi) / 2;
        if (fx(u) < x) lo = u; else hi = u;
      }
    }
    return fy(u);
  };
}

/** Progress of a spring that looks settled after `duration` seconds. May overshoot 1. */
export function spring({ duration, bounce = 0 }: SpringSpec): (x: number) => number {
  const w0 = (2 * Math.PI) / (Math.max(0.05, duration) * 1.2);
  const z = clamp(1 - bounce, 0.05, 1);
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Progress 0..1 covers the whole settling time, not just the first arrival.
    const dt = x * duration * (1 + 2 * bounce);
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w0 * dt) * (Math.cos(wd * dt) + ((z * w0) / wd) * Math.sin(wd * dt));
    }
    return 1 - Math.exp(-w0 * dt) * (1 + w0 * dt);
  };
}

/**
 * The `ui.*` curves are the bydiorama/ui easing tokens (`--ui-ease-*`). A page that
 * loads a ui theme replaces them with the theme's own values (see dom/tokens.ts).
 */
export const UI_EASE: Record<string, Bezier> = {
  'ui.default': [0.2, 0, 0, 1],
  'ui.in': [0.4, 0, 1, 1],
  'ui.out': [0, 0, 0.2, 1],
  'ui.spring': [0.22, 1, 0.36, 1],
};

/**
 * Asymmetric curves for film: arrivals that spend most of their time settling,
 * exits that leave fast and late. Shared with the craft guide (docs/CRAFT.md).
 */
export const EXPRESSIVE: Record<string, Bezier> = {
  'expressive.out': [0.05, 0.7, 0.1, 1],
  'expressive.in': [0.3, 0, 0.8, 0.15],
  'expressive.inOut': [0.7, 0, 0.1, 1],
  // A hard ease-out with a finite start: things are placed, not floated in.
  'snap.out': [0.3, 0.9, 0.1, 1],
  // Pulls back a little, then whips away: exits with weight.
  'anticipate.in': [0.45, -0.48, 1, -0.82],
};

/** The nearest cubic-bezier to each named curve: what a curve editor shows for it. */
export const EASE_BEZIER: Record<string, Bezier> = {
  linear: [0, 0, 1, 1], smooth: [0.45, 0, 0.55, 1],
  'sine.in': [0.12, 0, 0.39, 0], 'sine.out': [0.61, 1, 0.88, 1], 'sine.inOut': [0.37, 0, 0.63, 1],
  'cubic.in': [0.32, 0, 0.67, 0], 'cubic.out': [0.33, 1, 0.68, 1], 'cubic.inOut': [0.65, 0, 0.35, 1],
  'expo.in': [0.7, 0, 0.84, 0], 'expo.out': [0.16, 1, 0.3, 1], 'expo.inOut': [0.87, 0, 0.13, 1],
  'quad.in': [0.11, 0, 0.5, 0], 'quad.out': [0.5, 1, 0.89, 1], 'quad.inOut': [0.45, 0, 0.55, 1],
  'quart.in': [0.5, 0, 0.75, 0], 'quart.out': [0.25, 1, 0.5, 1], 'quart.inOut': [0.76, 0, 0.24, 1],
  'quint.in': [0.64, 0, 0.78, 0], 'quint.out': [0.22, 1, 0.36, 1], 'quint.inOut': [0.83, 0, 0.17, 1],
  'circ.in': [0.55, 0, 1, 0.45], 'circ.out': [0, 0.55, 0.45, 1], 'circ.inOut': [0.85, 0, 0.15, 1],
  'back.in': [0.36, 0, 0.66, -0.56], 'back.out': [0.34, 1.56, 0.64, 1], 'back.inOut': [0.68, -0.6, 0.32, 1.6],
  // No cubic matches an elastic; the curve editor shows the nearest overshoot.
  'elastic.out': [0.34, 1.56, 0.64, 1],
  ...EXPRESSIVE,
  ...UI_EASE,
};

const NAMED: Record<string, (x: number) => number> = {
  linear: (x) => x,
  'sine.in': (x) => 1 - Math.cos((x * Math.PI) / 2),
  'sine.out': (x) => Math.sin((x * Math.PI) / 2),
  'sine.inOut': (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  'cubic.in': (x) => x * x * x,
  'cubic.out': (x) => 1 - Math.pow(1 - x, 3),
  'cubic.inOut': (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  'expo.in': (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  'expo.out': (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  'expo.inOut': (x) =>
    x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  'back.out': (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
  smooth: (x) => x * x * x * (x * (x * 6 - 15) + 10),
  'quad.in': (x) => x * x,
  'quad.out': (x) => 1 - (1 - x) * (1 - x),
  'quad.inOut': (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  'quart.in': (x) => x * x * x * x,
  'quart.out': (x) => 1 - Math.pow(1 - x, 4),
  'quart.inOut': (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
  'quint.in': (x) => x * x * x * x * x,
  'quint.out': (x) => 1 - Math.pow(1 - x, 5),
  'quint.inOut': (x) => (x < 0.5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2),
  'circ.in': (x) => 1 - Math.sqrt(1 - x * x),
  'circ.out': (x) => Math.sqrt(1 - Math.pow(x - 1, 2)),
  'circ.inOut': (x) => (x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2),
  'back.in': (x) => 2.70158 * x * x * x - 1.70158 * x * x,
  'back.inOut': (x) => {
    const c = 1.70158 * 1.525;
    return x < 0.5 ? (Math.pow(2 * x, 2) * ((c + 1) * 2 * x - c)) / 2 : (Math.pow(2 * x - 2, 2) * ((c + 1) * (x * 2 - 2) + c) + 2) / 2;
  },
  'elastic.out': (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

export const EASE_NAMES: readonly string[] = [...Object.keys(NAMED), ...Object.keys(EXPRESSIVE), ...Object.keys(UI_EASE)];

export const isEaseSpec = (v: unknown): v is EaseSpec => {
  if (typeof v === 'string') return true;
  if (Array.isArray(v)) return v.length === 4 && v.every((n) => typeof n === 'number');
  if (v && typeof v === 'object' && 'spring' in v) {
    const s = (v as { spring: unknown }).spring;
    return !!s && typeof s === 'object' && typeof (s as SpringSpec).duration === 'number';
  }
  return false;
};

/** Turns a spec into a function of progress 0..1. `overrides` carries theme curves. */
export function resolveEase(spec: EaseSpec | undefined, overrides: Record<string, Bezier> = {}): (x: number) => number {
  if (spec === undefined) return NAMED['expo.out']!;
  if (typeof spec === 'string') {
    const themed = overrides[spec] ?? UI_EASE[spec] ?? EXPRESSIVE[spec];
    if (themed) return bezier(...themed);
    const named = NAMED[spec];
    if (!named) throw new Error(`Unknown ease "${spec}". Known: ${EASE_NAMES.join(', ')}`);
    return (x) => named(clamp(x));
  }
  if (Array.isArray(spec)) return bezier(...(spec as Bezier));
  return spring((spec as { spring: SpringSpec }).spring);
}

/** Eased progress 0..1 of a move that starts at `start` and lasts `duration` seconds. */
export function progress(t: number, start: number, duration: number, ease: (x: number) => number): number {
  if (duration <= 0) return t >= start ? 1 : 0;
  return ease(clamp((t - start) / duration));
}

/** Seeded random, so renders repeat exactly. */
export function rng(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
