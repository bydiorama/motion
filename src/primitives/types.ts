// The primitive contract. One module per library entry, at the same path as its slug.
//
//   duration(props, params, ctx)  pure: how long the animation runs, in seconds.
//                                 No DOM, so the timeline can be resolved in Node.
//   build(el, props, params, ctx) draws into `el` once and returns seek(t).
//                                 seek(t) draws the exact state t seconds after
//                                 the layer starts. No clock, no CSS transitions,
//                                 no unseeded randomness.
import type { Bezier, EaseSpec } from '../core/ease.ts';
import type { Tokens } from '../tokens.ts';

export interface ParamSpec {
  type: 'number' | 'ease' | 'boolean' | 'choice';
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: readonly string[];
  label: string;
  /** Two number params that share a pad name are tuned together on one 2D pad. */
  pad?: { name: string; axis: 'x' | 'y' };
  /** The library entry this param belongs to, when it is not the primitive's own. */
  from?: string;
}

export interface PropSpec {
  type: 'string' | 'number' | 'string[]' | 'html';
  required?: boolean;
  default?: unknown;
  label: string;
}

export interface Ctx {
  tokens: Tokens;
  seed: number;
  size: [number, number];
  /** Resolves an ease with the page theme's curves applied. */
  ease(spec: EaseSpec | undefined): (x: number) => number;
  easeOverrides: Record<string, Bezier>;
  /** Host-provided content for `el/slot` layers, by slot name. */
  slots: Record<string, (el: HTMLElement) => void>;
}

/** What `duration` may use: everything except the page. */
export type PureCtx = Pick<Ctx, 'tokens' | 'seed' | 'size'>;

export interface Instance {
  seek(t: number): void;
}

export interface Primitive {
  slug: string;
  summary: string;
  props: Record<string, PropSpec>;
  params: Record<string, ParamSpec>;
  duration(props: Record<string, unknown>, params: Record<string, unknown>, ctx: PureCtx): number;
  build(el: HTMLElement, props: Record<string, unknown>, params: Record<string, unknown>, ctx: Ctx): Instance;
}

export interface TransitionPrimitive {
  slug: string;
  summary: string;
  params: Record<string, ParamSpec>;
  /** Default overlap in seconds. */
  duration: number | string;
  /** Draws the hand-over at progress k (0 = only the outgoing scene, 1 = only the incoming). */
  apply(from: HTMLElement, to: HTMLElement, k: number, params: Record<string, unknown>, ctx: Ctx): void;
  /** Removes whatever `apply` set, once the hand-over is not on screen. */
  clear(el: HTMLElement): void;
}

export const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
export const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : v == null ? fallback : String(v));
export const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
