// Easing and helpers shared by all recipes. Names match tokens.yaml.
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ease = {
  linear: (x) => x,
  'expo.out': (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  'cubic.in': (x) => x * x * x,
  'cubic.inOut': (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
};
// Progress 0..1 of a move that starts at `start` and lasts `dur` seconds.
export const progress = (t, start, dur, name = 'expo.out') =>
  ease[name](clamp01(dur <= 0 ? (t >= start ? 1 : 0) : (t - start) / dur));
// Seeded random, so renders repeat exactly.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
