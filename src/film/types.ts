// The film document. This is what an agent writes and what a person tunes.
// It is plain JSON: no functions, no absolute clock times that must be kept in
// step by hand. Scenes run in order; layers are placed relative to their scene
// or to each other by id.
import type { EaseSpec } from '../core/ease.ts';
import type { Key } from '../core/track.ts';
import type { TokenOverrides } from '../tokens.ts';
import type { Tempo } from './tempo.ts';
import type { Cue } from '../primitives/types.ts';

/**
 * Seconds from the scene start, or `"<layer id>.start|end"` / `"scene.end"`, optionally
 * `± seconds` or `± beats` (`"title.end + 1b"`). With a tempo, `"4b"` alone is a time too.
 */
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
 *  slot-up: rises `amount` px into its own box, cut off at the box's bottom edge, no
 *    fade: a picture settling into a slot that was already there.
 *  wipe: like wipe-*, along any `angle`; it can also travel `amount` px that way as it is
 *    uncovered, so a band unrolls along its own slant.
 *  slide: like slide-*, along any `angle`.
 */
export type MoveName =
  | 'fade' | 'rise' | 'drop' | 'scale' | 'blur' | 'slide-left' | 'slide-right'
  | 'zoom' | 'pop' | 'focus' | 'mask-up' | 'mask-down' | 'wipe-up' | 'wipe-down' | 'wipe-left' | 'wipe-right' | 'swing' | 'slot-up'
  | 'wipe' | 'slide';
export const MOVE_NAMES: readonly MoveName[] = [
  'fade', 'rise', 'drop', 'scale', 'blur', 'slide-left', 'slide-right',
  'zoom', 'pop', 'focus', 'mask-up', 'mask-down', 'wipe-up', 'wipe-down', 'wipe-left', 'wipe-right', 'swing', 'slot-up',
  'wipe', 'slide',
];
/** Moves that take an `angle`. */
export const ANGLED_MOVES: readonly MoveName[] = ['wipe', 'slide'];

export interface Move {
  move: MoveName;
  /** Seconds, or a token such as `"$duration.base"`. */
  duration?: number | string;
  ease?: EaseSpec;
  /** Travel in px for rise, drop, slide and focus; scale offset for scale, zoom and pop; px for blur; degrees for swing; travel along the angle for wipe. Masks and wipe-* ignore it. */
  amount?: number;
  /** For wipe and slide: the direction the edge or the layer travels, in degrees. 0 is rightwards, 90 downwards, 180 leftwards, 270 upwards. */
  angle?: number;
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
  /** Measured to the layer's anchor: percent of the stage, or with `unit: "px"` pixels of the scene's artboard. */
  x: number;
  y: number;
  anchor?: 'center' | 'top-left' | 'top' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';
  /**
   * `%` (the default): percent of the stage. `px`: pixels of the scene's artboard, the
   * design the layer was taken from; the layer sits on the artboard and is scaled with it,
   * so its size, tracks and move amounts are design pixels too. Without an artboard, px are
   * the stage's own.
   */
  unit?: '%' | 'px';
}
export const ANCHORS = ['center', 'top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'] as const;
export const PLACE_UNITS = ['%', 'px'] as const;

/**
 * A design's own frame, laid on the stage: a 1920×1080 slide or a 4:5 post rebuilt from its
 * layers. Layers placed in `px` keep the design's coordinates and sizes, and the artboard
 * is scaled to the stage as one.
 */
export interface Artboard {
  /** The design's size in its own pixels. */
  width: number;
  height: number;
  /**
   * How it meets the stage: `cover` fills it and lets the rest fall off (the default),
   * `contain` shows all of it, `width` and `height` match that side.
   */
  fit?: 'cover' | 'contain' | 'width' | 'height';
  /** Where it sits when it does not match the stage: percent along each side, [0, 0] top-left. Default [50, 50]. */
  align?: [number, number];
}
export interface Parallax {
  depth: number;
  home?: TimeRef;
}

export const ARTBOARD_FITS = ['cover', 'contain', 'width', 'height'] as const;

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
  /**
   * Depth against the scene's camera, so layers of one picture travel at different speeds
   * (parallax). 1 travels with the scene, above 1 is nearer and faster, below 1 farther and
   * slower, 0 holds still on the stage. A number, or `{ depth, home }`, where `home` is the
   * moment the layer sits exactly where it is placed (default: the scene's end, the frame
   * the camera arrives at). It follows the camera's x and y travel.
   */
  parallax?: number | Parallax;
  /**
   * Motion blur while the layer moves: `true` for a half-frame shutter, or the
   * share of a frame the shutter is open (0–1). Smears along the path only and
   * is gone when the layer stops.
   */
  motionBlur?: boolean | number;
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

/**
 * The camera follows the tip of a line as it draws: the tip is held at `at`
 * on stage while the scene's own camera tracks still set zoom and rotation.
 */
export interface Follow {
  /** Id of a layer in this scene whose primitive has a tip, e.g. fx/path-draw. */
  layer: string;
  /** Where on stage the tip is held, in % of the stage. Default [50, 50]. */
  at?: [number, number];
  /** Seconds the camera trails the tip by, averaged so it moves smoothly. Default 0. */
  lag?: number;
  /** Seconds to hand over from the scene's own x and y tracks to following, from the layer's start. Default 0.6. */
  blend?: number;
}

export interface Scene {
  id: string;
  /** Seconds, or beats (`"8b"`, `"2bars"`). Left out, the scene lasts until its last layer ends, plus `hold`. */
  length?: number | string;
  /** Seconds of stillness after the last layer ends, or a token such as `"$hold_end"`. Defaults to the `hold` token. */
  hold?: number | string;
  /** A surface name, or any CSS colour. */
  background?: Surface | string;
  scheme?: 'light' | 'dark';
  layout?: SceneLayout;
  /** A design's frame for layers placed in `px`. */
  artboard?: Artboard;
  layers: Layer[];
  /** Camera: keyframes in seconds from the scene start, applied to the whole scene. */
  tracks?: Tracks;
  /** Camera follows the tip of a line being drawn. Replaces the x and y tracks while it follows. */
  follow?: Follow;
  /** How this scene hands over to the next. The two scenes overlap by the duration. */
  out?: Transition;
  /** Vocabulary slugs this scene is built from. Informational; checked against the library. */
  uses?: string[];
  /** A note for the next reader, agent or person. */
  intent?: string;
}

/** The bydiorama/ui themes a stage can wear (`theme.ui`). */
export const UI_THEME_NAMES = ['zero', 'graphite', 'hockney'] as const;

export interface Theme {
  scheme?: 'light' | 'dark';
  /** The accent colour, as any CSS colour. Left out, it comes from the page theme. */
  accent?: string;
  /** Text colour on the accent. Defaults to white or near-black, whichever reads better. */
  onAccent?: string;
  /**
   * A bydiorama/ui theme on the stage: its fonts (Aspekta), colour roles and radii
   * become the stage's --ui-* tokens, which the --m-* roles read. `accent` and
   * `vars` still win over it.
   */
  ui?: (typeof UI_THEME_NAMES)[number];
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
  /**
   * One pulse for the whole film. With it, times can be written in beats and bars
   * ("2b", "1bar") and `motion pace` checks cuts and changes against the grid.
   */
  tempo?: { bpm: number; bar?: number };
  /**
   * A soundtrack: film time 0 plays the file from `from` seconds. The studio plays it
   * in step with the playhead and `render` lays it under the video. With music, set
   * `tempo` to the track's own and `from` on one of its downbeats.
   */
  audio?: FilmAudio;
  theme?: Theme;
  scenes: Scene[];
}

export interface FilmAudio {
  /** Path to the file, relative to the film, like any picture. */
  src: string;
  /** Seconds into the file that film time 0 plays. */
  from?: number;
  /** Level in dB, -30 to 6. */
  gain?: number;
  /** Seconds the sound fades in at the start and out at the end. A loop keeps them short, so the seam does not dip. */
  fade_in?: number;
  fade_out?: number;
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
  /** Degrees, for wipe and slide. */
  angle?: number;
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
  /** Changes inside the primitive's own run (a picture swap, a turn), from the layer start. */
  cues?: Cue[];
  /** Fastest travel of the layer's picture across the stage, px a second, when the primitive reports it. */
  speed?: number;
  /** Depth against the camera, and the scene time it sits where it is placed. */
  parallax?: { depth: number; home: number };
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
  tempo?: Tempo;
  loop?: boolean;
  audio?: Required<FilmAudio>;
}
