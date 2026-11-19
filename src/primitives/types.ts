// The primitive contract. One module per library entry, at the same path as its slug.
//
//   duration(props, params, ctx)  pure: how long the animation runs, in seconds.
//                                 No DOM, so the timeline can be resolved in Node.
//   build(el, props, params, ctx) draws into `el` once and returns seek(t).
//                                 seek(t) draws the exact state t seconds after
//                                 the layer starts. No clock, no CSS transitions,
//                                 no unseeded randomness.
//
// The engine owns the transform, opacity, filter and clip-path of `el` (and a
// transition owns them on the scene), so draw those on children. A child that is
// hidden and shown again uses visibility 'inherit', never 'visible', or it shows
// through a hidden scene.
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
  type: 'string' | 'number' | 'string[]' | 'number[]' | 'html';
  required?: boolean;
  default?: unknown;
  label: string;
}

export interface Ctx {
  tokens: Tokens;
  seed: number;
  size: [number, number];
  /** Frames per second of the film being drawn: speeds in px per frame need it. */
  fps: number;
  /** Resolves an ease with the page theme's curves applied. */
  ease(spec: EaseSpec | undefined): (x: number) => number;
  easeOverrides: Record<string, Bezier>;
  /** Host-provided content for `el/slot` layers, by slot name. */
  slots: Record<string, (el: HTMLElement) => void>;
  /**
   * Still frames pulled from this layer's footage, when drawing for a render.
   * Set per layer by the CLI (render, check, stills); left out in the studio,
   * where footage plays from a video element.
   */
  frames?: FrameSequence;
  /** Seconds per beat, when the film has a tempo. Light that pulses on the beat reads it. */
  beat?: number;
  /** The film time this layer starts at, so a phase can come from the film's clock, not the layer's. */
  filmStart?: number;
  /**
   * The scale the camera shows this layer's scene at in the frame being drawn: 2 when it is
   * twice as big. A canvas sizes its bitmap to it, so it stays sharp in a close-up. It is the
   * frame's own camera, read after the camera is placed, so it never lags a frame.
   */
  cameraScale?: () => number;
  /**
   * Where another layer of the same scene sits, laid out and unmoved, in the camera's px (the
   * stage's px at rest): for a field that keeps clear of the marks on it. Undefined for an id
   * the scene does not have. Measure in seek, not build: later layers are not built yet then.
   */
  boxOf?: (id: string) => { x: number; y: number; w: number; h: number } | undefined;
  /** The camera of this layer's scene in the frame being drawn: its scale and its tilt in degrees. */
  cameraPose?: () => { scale: number; rotateX: number; rotateY: number };
  /**
   * Smaller copies of this layer's footage (½, ¼, …), largest first, for a picture shown much
   * smaller than it was pulled: drawing each size from the copy nearest it keeps fine detail from
   * shimmering as the camera pulls out.
   */
  mips?: FrameSequence[];
}

/** Frames of a video, extracted to numbered images so every film frame is exact. */
export interface FrameSequence {
  /** URL prefix; frame n (0-based) is `${base}${String(n + 1).padStart(5, '0')}.${ext}`. */
  base: string;
  ext: string;
  count: number;
  /** Source time of frame 0, in seconds. */
  start: number;
  /** Extracted frames per second of source time. */
  rate: number;
  /** The source's own size in px. */
  width: number;
  height: number;
  /** Boxes of elements recorded with the footage (`motion record --marks`), in the source's px. */
  marks?: { fps: number; size: [number, number]; marks: Record<string, ([number, number, number, number] | null)[]> };
}

export const frameUrl = (f: FrameSequence, n: number): string =>
  `${f.base}${String(Math.min(f.count - 1, Math.max(0, n)) + 1).padStart(5, '0')}.${f.ext}`;

/** What `duration` may use: everything except the page. */
export type PureCtx = Pick<Ctx, 'tokens' | 'seed' | 'size'>;

export interface Instance {
  seek(t: number): void;
  /**
   * Resolves when what the last seek asked for is on screen. Only for content
   * that loads after a seek, such as the next frame of footage; the page awaits
   * it before a frame is captured.
   */
  pending?(): Promise<void>;
  /**
   * Where the primitive's moving point is at t, in px from the layer's top-left:
   * the tip of a line being drawn. A scene's camera can follow it.
   */
  tip?(t: number): [number, number] | undefined;
  /**
   * Where a named mark in the primitive's picture is at t, as [x, y, width, height] in px from
   * the layer's top-left, unmoved: the button a camera key frames, or a tap's ring goes round.
   */
  markAt?(name: string, t: number): [number, number, number, number] | undefined;
}

/**
 * A change inside a primitive's own run: a picture swap, a slide turning, a strip
 * shift. Seconds from the layer start. The pace check reads these to see whether a
 * film's changes share one length and land on its beat.
 */
export interface Cue {
  at: number;
  length: number;
  /** Which part changes (a tile, a row), when several change on their own clocks. Rests are measured per lane. */
  lane?: number;
  /** Share of the frame that changes, 0–1: a tile a quarter of the frame is 0.25. Left out, the whole frame. */
  share?: number;
}

/** A problem a primitive finds in its own props and params, beyond their types and ranges. */
export interface PrimitiveIssue {
  /** Relative to the layer, e.g. `props.to`. */
  path: string;
  message: string;
  hint?: string;
}

export interface Primitive {
  slug: string;
  summary: string;
  props: Record<string, PropSpec>;
  params: Record<string, ParamSpec>;
  duration(props: Record<string, unknown>, params: Record<string, unknown>, ctx: PureCtx): number;
  /** Optional checks that need more than one value at a time. Pure, like duration. */
  check?(props: Record<string, unknown>, params: Record<string, unknown>, ctx: PureCtx): PrimitiveIssue[];
  build(el: HTMLElement, props: Record<string, unknown>, params: Record<string, unknown>, ctx: Ctx): Instance;
  /**
   * Optional, pure: the changes inside the run, for primitives that hold and change
   * on their own clock. Return [] for ambient motion (drift, grain, marquees) that
   * never reads as a move. Left out, the whole run counts as one move.
   */
  cues?(props: Record<string, unknown>, params: Record<string, unknown>, ctx: PureCtx): Cue[];
  /**
   * The layer runs in rounds with no natural end (a living wall): its duration is
   * one full round, and a scene may end it on any rest between changes. A scene
   * that ends it in the middle of a change is still reported.
   */
  cycles?: boolean;
  /**
   * Optional, pure: the fastest the layer's picture travels across the stage, in px a
   * second (a pan along a wide picture). The pace check warns when a frame-to-frame
   * step is large enough to strobe.
   */
  speed?(props: Record<string, unknown>, params: Record<string, unknown>, ctx: PureCtx): number;
}

export interface TransitionPrimitive {
  slug: string;
  summary: string;
  params: Record<string, ParamSpec>;
  /** Default overlap in seconds. */
  duration: number | string;
  /** Quieter defaults, used when the film's `transitions` token is `calm`. Each must sit inside its param's range. */
  calm?: Record<string, number | string | boolean>;
  /** Draws the hand-over at progress k (0 = only the outgoing scene, 1 = only the incoming). */
  apply(from: HTMLElement, to: HTMLElement, k: number, params: Record<string, unknown>, ctx: Ctx): void;
  /** Removes whatever `apply` set, once the hand-over is not on screen. */
  clear(el: HTMLElement): void;
}

export const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
export const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : v == null ? fallback : String(v));
export const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
export const nums = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => num(x)) : []);
