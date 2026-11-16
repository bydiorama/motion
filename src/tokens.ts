// Timing tokens. The defaults mirror tokens.yaml (tools/validate.py checks they
// match). A film overrides them under `tokens`; a style does the same by name.
import type { EaseSpec } from './core/ease.ts';

export interface Tokens {
  fps: number;
  beat: number;
  hold: number;
  hold_end: number;
  duration: { instant: number; fast: number; base: number; slow: number };
  stagger: { tight: number; base: number; loose: number };
  ease_enter: EaseSpec;
  ease_exit: EaseSpec;
  ease_move: EaseSpec;
  ease_loop: EaseSpec;
  /**
   * How far transitions travel, lean and blur. `calm` swaps every transition's
   * defaults for its quiet preset (a camera that barely pulls back, no tumble);
   * values a film sets itself still win.
   */
  transitions: 'standard' | 'calm';
  /** bydiorama/ui interface timings in seconds. Replaced by the theme on a page that loads one. */
  ui: { duration: { fast: number; base: number; slow: number; enter: number }; stagger: number };
}

export type TokenOverrides = { [K in keyof Tokens]?: Tokens[K] extends object ? Partial<Tokens[K]> : Tokens[K] };

export const DEFAULT_TOKENS: Tokens = {
  fps: 30,
  beat: 2.5,
  hold: 0.6,
  hold_end: 1.5,
  duration: { instant: 0, fast: 0.3, base: 0.5, slow: 0.8 },
  stagger: { tight: 0.03, base: 0.08, loose: 0.12 },
  ease_enter: 'expo.out',
  ease_exit: 'cubic.in',
  ease_move: 'cubic.inOut',
  ease_loop: 'linear',
  transitions: 'standard',
  ui: { duration: { fast: 0.12, base: 0.2, slow: 0.32, enter: 0.4 }, stagger: 0.1 },
};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Deep merge of plain objects. Arrays and scalars are replaced. */
export function merge<T>(base: T, over: unknown): T {
  if (!isObject(base) || !isObject(over)) return (over === undefined ? base : over) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = merge(out[k], v);
  return out as T;
}

export const mergeTokens = (...layers: (TokenOverrides | undefined)[]): Tokens =>
  layers.reduce<Tokens>((acc, l) => merge(acc, l), DEFAULT_TOKENS);

/** Every token path a film may reference as `$path`, e.g. `$duration.base`. */
export function tokenPaths(tokens: Tokens): string[] {
  const out: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (isObject(v) && !('spring' in v)) for (const [k, c] of Object.entries(v)) walk(c, path ? `${path}.${k}` : k);
    else out.push(path);
  };
  walk(tokens, '');
  return out;
}

/** Reads `$duration.base` style references. Returns undefined when the path is unknown. */
export function readToken(tokens: Tokens, ref: string): unknown {
  let cur: unknown = tokens;
  for (const part of ref.replace(/^\$/, '').split('.')) {
    if (!isObject(cur) || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

export const isTokenRef = (v: unknown): v is string => typeof v === 'string' && v.startsWith('$');
