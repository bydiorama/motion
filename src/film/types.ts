// The film document. This is what an agent writes and what a person tunes.
// It is plain JSON: no functions, no absolute clock times that must be kept in
// step by hand. Scenes run in order; layers are placed relative to their scene
// or to each other by id.
import type { EaseSpec } from '../core/ease.ts';
import type { Key } from '../core/track.ts';
import type { TokenOverrides } from '../tokens.ts';

/** Seconds from the scene start, or `"<layer id>.start|end"` / `"scene.end"`, optionally `± seconds`. */
export type TimeRef = number | string;

export type TrackProp = 'x' | 'y' | 'scale' | 'rotate' | 'opacity' | 'blur' | 'rotateX' | 'rotateY' | 'skew';
export const TRACK_PROPS: readonly TrackProp[] = ['x', 'y', 'scale', 'rotate', 'opacity', 'blur', 'rotateX', 'rotateY', 'skew'];
export type Tracks = Partial<Record<TrackProp, Key[]>>;

/**
 * Enter and exit moves for any layer.
 *  fade, rise, drop, slide-*: opacity with a travel in px.
 *  scale: grows from slightly small. zoom: settles from slightly large. pop: grows with an overshoot.
 *  blur: comes into focus. focus: comes into focus while rising (a soft arrival).
 *  mask-up, mask-down: slides out from under its own edge, without fading (a line reveal).
 *  wipe-*: an edge travels across the layer and uncovers it, without moving it.
 *  swing: turns in on a horizontal hinge, in perspective.
 */
export type MoveName =
  | 'fade' | 'rise' | 'drop' | 'scale' | 'blur' | 'slide-left' | 'slide-right'
  | 'zoom' | 'pop' | 'focus' | 'mask-up' | 'mask-down' | 'wipe-up' | 'wipe-down' | 'wipe-left' | 'wipe-right' | 'swing';
export const MOVE_NAMES: readonly MoveName[] = [
  'fade', 'rise', 'drop', 'scale', 'blur', 'slide-left', 'slide-right',
  'zoom', 'pop', 'focus', 'mask-up', 'mask-down', 'wipe-up', 'wipe-down', 'wipe-left', 'wipe-right', 'swing',
];

export interface Move {
  move: MoveName;
  /** Seconds, or a token such as `"$duration.base"`. */
  duration?: number | string;
  ease?: EaseSpec;
  /** Travel in px for rise, drop, slide and focus; scale offset for scale, zoom and pop; px for blur; degrees for swing. Masks and wipes ignore it. */
  amount?: number;
}
export interface ExitMove extends Move {
  /** When the exit starts. Defaults to the scene end minus the exit duration. */
  at?: TimeRef;
}

export type TextSize = 'hero' | 'headline' | 'title' | 'body' | 'caption';
export const TEXT_SIZES: readonly TextSize[] = ['hero', 'headline', 'title', 'body', 'caption'];
export type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'inverse' | 'on-accent';
export const TONES: readonly Tone[] = ['primary', 'secondary', 'muted', 'accent', 'inverse', 'on-accent'];

export interface LayerStyle {
  size?: TextSize;
  color?: Tone;
  font?: 'display' | 'body' | 'mono';
  weight?: number;
  align?: 'left' | 'center' | 'right';
  /** Max width as a percentage of the stage width. */
  width?: number;
  /** Escape hatch: raw inline CSS, for a person's last-mile fixes. */
  css?: Record<string, string>;
}

export interface Place {
  /** Percent of the stage, measured to the layer's anchor. */
  x: number;
  y: number;
  anchor?: 'center' | 'top-left' | 'top' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';
}
export const ANCHORS = ['center', 'top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'] as const;

export interface Layer {
  id: string;
  /** Primitive slug, e.g. `type/word-build`. See catalog.json. */
  use: string;
  /** Content: the words, numbers and media. Written by the agent or a copywriter. */
  props?: Record<string, unknown>;
  /** Motion values. Each has a default and a range in the catalog; these are what a person tunes. */
  params?: Record<string, unknown>;
  at?: TimeRef;
  style?: LayerStyle;
  /** Absolute placement. Without it the layer joins the scene's stack. */
  place?: Place;
  enter?: MoveName | Move;
  exit?: MoveName | ExitMove;
  /** Keyframes in seconds from the layer start. */
  tracks?: Tracks;
}

export type Surface = 'base' | 'surface' | 'sunken' | 'accent' | 'inverse';
export const SURFACES: readonly Surface[] = ['base', 'surface', 'sunken', 'accent', 'inverse'];

export interface SceneLayout {
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'between';
  /** px on the stage */
  gap?: number;
  padding?: number;
}

export interface Transition {
  /** Transition slug, e.g. `transition/blur-dissolve`. */
  use: string;
  duration?: number | string;
  params?: Record<string, unknown>;
}

export interface Scene {
  id: string;
  /** Seconds. Left out, the scene lasts until its last layer ends, plus `hold`. */
  length?: number;
  /** Seconds of stillness after the last layer ends, or a token such as `"$hold_end"`. Defaults to the `hold` token. */
  hold?: number | string;
  /** A surface name, or any CSS colour. */
  background?: Surface | string;
  scheme?: 'light' | 'dark';
  layout?: SceneLayout;
  layers: Layer[];
  /** Camera: keyframes in seconds from the scene start, applied to the whole scene. */
  tracks?: Tracks;
  /** How this scene hands over to the next. The two scenes overlap by the duration. */
  out?: Transition;
  /** Vocabulary slugs this scene is built from. Informational; checked against the library. */
  uses?: string[];
  /** A note for the next reader, agent or person. */
  intent?: string;
}

export interface Theme {
  scheme?: 'light' | 'dark';
  /** The accent colour, as any CSS colour. Left out, it comes from the page theme. */
  accent?: string;
  /** Text colour on the accent. Defaults to white or near-black, whichever reads better. */
  onAccent?: string;
  /** CSS custom properties set on the stage, e.g. `{"--ui-bg-accent": "#2440F0"}`. */
  vars?: Record<string, string>;
}

export interface Film {
  /** Library version this film was written for. */
  motion: string;
  title?: string;
  /** Stage size in px. Every px value in the film is on this canvas. */
  size: [number, number];
  fps?: number;
  seed?: number;
  /** Still frame used under reduced motion and as the cover. Seconds. */
  poster?: number;
  loop?: boolean;
  narrative?: string;
  style?: string;
  tokens?: TokenOverrides;
  theme?: Theme;
  scenes: Scene[];
}

// ---- tuning: the person's file -------------------------------------------------

export interface Note {
  id: string;
  /** Film time in seconds the note was pinned at. */
  t: number;
  scene?: string;
  layer?: string;
  text: string;
  status: 'open' | 'done';
  /** What was changed in answer to the note. Filled in by whoever resolves it. */
  reply?: string;
}

export interface Tune {
  /** Overrides by path, e.g. `"scenes.title.layers.headline.params.stagger": 0.12`. */
  set?: Record<string, unknown>;
  notes?: Note[];
}

// ---- resolved timeline ---------------------------------------------------------

export interface ResolvedMove {
  move: MoveName;
  /** Seconds from the scene start. */
  start: number;
  duration: number;
  ease: EaseSpec;
  amount?: number;
}

export interface ResolvedLayer {
  id: string;
  use: string;
  /** Seconds from the scene start. */
  start: number;
  /** Length of the primitive's own animation. */
  duration: number;
  end: number;
  props: Record<string, unknown>;
  /** Defaults, then the film's values, with token references replaced. */
  params: Record<string, unknown>;
  enter?: ResolvedMove;
  exit?: ResolvedMove;
  source: Layer;
}

export interface ResolvedScene {
  id: string;
  /** Film time in seconds. */
  start: number;
  length: number;
  end: number;
  layers: ResolvedLayer[];
  out?: { use: string; duration: number; params: Record<string, unknown> };
  source: Scene;
}

export interface Issue {
  level: 'error' | 'warning';
  code: string;
  /** Where in the film, e.g. `scenes.title.layers.headline.params.stagger`. */
  path: string;
  message: string;
  /** What to do about it. */
  hint?: string;
}

export interface Timeline {
  duration: number;
  fps: number;
  frames: number;
  size: [number, number];
  scenes: ResolvedScene[];
}
