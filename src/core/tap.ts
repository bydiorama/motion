// A tap on a control, as a viewer reads it: the control goes down under the finger
// and lands on the moment of the tap, comes back up past rest and home, and a thin
// ring leaves it in its own shape. Pure functions of time, so a tap looks the same
// at any frame rate and from any seek.
import { bezier as cubicBezier } from './ease.ts';

/** Seconds the control takes to go down: it is fully down at the tap. */
export const PRESS_DOWN = 0.08;
/** Seconds it takes to come back up, past rest and home. */
export const PRESS_UP = 0.35;
/** How far down it goes: 7% smaller. */
export const PRESS_DEPTH = 0.07;
/** Seconds the ring takes to leave. */
export const RING_LIFE = 0.5;
/** Px the ring grows by while it leaves. */
export const RING_GROW = 12;
/** The ring's opacity as it starts. */
export const RING_OPACITY = 0.7;

const bounce = cubicBezier(0.34, 1.36, 0.64, 1);
// The reel's smoothOut: quick away from the control, slow as it fades.
const smoothOut = cubicBezier(0.22, 1, 0.36, 1);

/** The control's scale at `t` for taps at the given times (seconds, same clock). */
export function pressAt(taps: readonly number[], t: number): number {
  let s = 1;
  for (const at of taps) {
    const d = t - at;
    if (d < -PRESS_DOWN || d > PRESS_UP) continue;
    s *= d < 0 ? 1 - PRESS_DEPTH * ((d + PRESS_DOWN) / PRESS_DOWN) : 1 - PRESS_DEPTH + PRESS_DEPTH * bounce(d / PRESS_UP);
  }
  return s;
}

/** The ring of the latest tap still leaving at `t`, or none. */
export function ringAt(taps: readonly number[], t: number): { grow: number; opacity: number } | undefined {
  let latest: number | undefined;
  for (const at of taps) if (t >= at && t - at <= RING_LIFE && (latest === undefined || at > latest)) latest = at;
  if (latest === undefined) return undefined;
  const p = (t - latest) / RING_LIFE;
  return { grow: RING_GROW * smoothOut(p), opacity: RING_OPACITY * (1 - p) };
}
