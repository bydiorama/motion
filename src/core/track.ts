// Keyframe tracks: a value over time. The ease on a key shapes the move that
// arrives at that key, so a key reads "be at v by t, getting there like this".
import { resolveEase, type Bezier, type EaseSpec } from './ease.ts';

/** `[time in seconds, value, ease of the move arriving here]` */
export type Key = readonly [number, number] | readonly [number, number, EaseSpec];

export function track(
  keys: readonly Key[],
  defaultEase: EaseSpec = 'sine.inOut',
  overrides: Record<string, Bezier> = {},
): (t: number) => number {
  if (keys.length === 0) throw new Error('A track needs at least one key');
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  const eases = sorted.map((k) => resolveEase(k[2] ?? defaultEase, overrides));
  return (t) => {
    const first = sorted[0]!, last = sorted[sorted.length - 1]!;
    if (t <= first[0]) return first[1];
    if (t >= last[0]) return last[1];
    let i = 1;
    while (sorted[i]![0] < t) i++;
    const a = sorted[i - 1]!, b = sorted[i]!;
    const span = b[0] - a[0];
    const k = span <= 0 ? 1 : eases[i]!((t - a[0]) / span);
    return a[1] + (b[1] - a[1]) * k;
  };
}
