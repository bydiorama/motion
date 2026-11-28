// Draws a film into a page. Everything on screen is written by seek(t) from the
// film time alone, so frames can be drawn in any order and always come out the same.
import { clamp, progress, resolveEase, type Bezier, type EaseSpec } from '../core/ease.ts';
import { track } from '../core/track.ts';
import { frameAt, type FrameKey } from '../core/frame.ts';
import { pressAt, ringAt } from '../core/tap.ts';
import { resolveFilm } from '../film/resolve.ts';
import { applyTune } from '../film/tune.ts';
import type { Artboard, Film, Issue, ResolvedLayer, ResolvedMove, ResolvedScene, Timeline, Tracks, Tune } from '../film/types.ts';
import { directionalBlur, streak } from '../primitives/blur.ts';
import { PRIMITIVES, TRANSITIONS } from '../primitives/index.ts';
import type { Ctx, FrameSequence, Instance } from '../primitives/types.ts';
import { merge, type Tokens } from '../tokens.ts';
import { STAGE_CSS } from './stage.css.ts';
import { ASPEKTA_URL, UI_THEMES, type UiThemeName } from './ui-themes.css.ts';
import { readUiTokens } from './tokens.ts';

export class FilmError extends Error {
  issues: Issue[];
  constructor(issues: Issue[]) {
    super(`The film has ${issues.filter((i) => i.level === 'error').length} error(s):\n` +
      issues.filter((i) => i.level === 'error').map((i) => `  ${i.path}: ${i.message}${i.hint ? ` ${i.hint}` : ''}`).join('\n'));
    this.issues = issues;
  }
}

export interface MountOptions {
  tune?: Tune;
  /** Fill `el/slot` layers, by slot name. Called once, when the film is mounted. */
  slots?: Record<string, (el: HTMLElement) => void>;
  /** Draw at the film's own pixel size instead of fitting the host. Used when rendering. */
  fixed?: boolean;
  /** Footage frames pulled by the CLI, by `"<scene>/<layer>"`. Without them el/video plays a video element. */
  frames?: Record<string, FrameSequence>;
}

export interface LayerBox {
  scene: string;
  layer: string;
  use: string;
  /** Stage px. */
  x: number; y: number; width: number; height: number;
  /** How far the layer reaches past each stage edge, in px. Zero when inside. */
  off: { left: number; top: number; right: number; bottom: number };
  empty: boolean;
}

export interface Mounted {
  film: Film;
  timeline: Timeline;
  tokens: Tokens;
  issues: Issue[];
  /** Tune overrides whose target is no longer in the film. */
  orphans: string[];
  duration: number;
  fps: number;
  stage: HTMLElement;
  /** Resolves when images are decoded and fonts are loaded: the first moment frames are final. */
  ready: Promise<void>;
  seek(t: number): void;
  /** Resolves when everything the last seek asked for has loaded, such as a frame of footage. */
  settled(): Promise<void>;
  /** Where every visible layer sits at time t. Seeks to t. */
  audit(t: number): LayerBox[];
  destroy(): void;
}

interface LiveLayer {
  spec: ResolvedLayer; el: HTMLElement; instance: Instance; tracks: Sampler; ease: { enter?: (x: number) => number; exit?: (x: number) => number }; shutter: number;
  /** Stage px to one of the layer's own px: the artboard's scale for a layer placed on one, else 1. */
  unit: number;
  /** Times it is tapped, scene seconds. */
  taps?: number[];
}
/** A tap's ring: drawn in the target's own parent, around its layout box, in its own shape. */
interface LiveRing {
  target: LiveLayer; el: HTMLElement; taps: number[];
  /** A mark in the target's picture: the ring goes round it where it is at the moment. */
  mark?: string;
  /** The box, in the parent's px, and the shape's corner radius. */
  box?: { x: number; y: number; w: number; h: number; radius: number };
}
interface LiveScene {
  spec: ResolvedScene; el: HTMLElement; cam: HTMLElement; layers: LiveLayer[]; tracks: Sampler; handover: boolean; follow?: LiveFollow;
  /** The framing camera's keys, aimed at layout boxes measured while nothing was moved. */
  frame?: FrameKey[];
  /** Px from the viewer for the camera's tilt, and the camera's shutter for motion blur. */
  depth: number; shutter: number;
  /** The camera at each parallax home time, worked out once. */
  homes: Map<number, Pose>;
  rings: LiveRing[];
  /** Layout glides: where every layer sits before the first glide, against the laid-out page, and each glide's travel. */
  glide?: { base: Map<LiveLayer, [number, number]>; steps: { t: number; delta: Map<LiveLayer, [number, number]> }[] };
}
/** A camera following a layer's tip: the layer, where its box sits in the camera's world, and the settings. */
interface LiveFollow { layer: LiveLayer; origin: [number, number]; at: [number, number]; lag: number; blend: number; scale: number }
type Sampler = Partial<Record<keyof Tracks, (t: number) => number>>;

const SURFACE = new Set(['base', 'surface', 'sunken', 'accent', 'inverse']);
const ANCHOR: Record<string, string> = {
  center: '-50% -50%', 'top-left': '0 0', top: '-50% 0', 'top-right': '-100% 0', left: '0 -50%', right: '-100% -50%',
  'bottom-left': '0 -100%', bottom: '-50% -100%', 'bottom-right': '-100% -100%',
};
const FLEX: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' };

/** How wide a placed layer can be, in % of the stage, before its anchor pushes it off stage. */
export function placedRoom(place: { x: number; anchor?: string }): number {
  const a = place.anchor ?? 'center', x = Math.min(100, Math.max(0, place.x));
  const room = a.endsWith('left') ? 100 - x : a.endsWith('right') ? x : 2 * Math.min(x, 100 - x);
  // Never narrower than a fifth of the stage: a layer anchored at the edge still needs a line.
  return Math.max(20, room);
}

function ensureCss(doc: Document) {
  if (doc.getElementById('m-stage-css')) return;
  const style = doc.createElement('style');
  style.id = 'm-stage-css';
  style.textContent = STAGE_CSS;
  doc.head.appendChild(style);
}

/**
 * A bundled theme for the stage (`theme.ui`), once per page: its --ui-*
 * tokens scoped to stages that ask for it, and Aspekta, embedded so stills and
 * renders never fall back to another face.
 */
function ensureUiTheme(doc: Document, name: UiThemeName) {
  const id = `m-ui-theme-${name}`;
  if (doc.getElementById(id)) return;
  const style = doc.createElement('style');
  style.id = id;
  const face = doc.getElementById('m-ui-font') ? '' : `@font-face { font-family: "Aspekta"; font-weight: 100 900; font-style: normal; font-display: block; src: url("${ASPEKTA_URL}") format("woff2"); }\n`;
  style.textContent = face + UI_THEMES[name];
  if (face) {
    const mark = doc.createElement('meta');
    mark.id = 'm-ui-font';
    doc.head.appendChild(mark);
  }
  doc.head.appendChild(style);
}

function samplers(tracks: Tracks | undefined, defaultEase: EaseSpec, overrides: Record<string, Bezier>): Sampler {
  const out: Sampler = {};
  for (const [prop, keys] of Object.entries(tracks ?? {})) out[prop as keyof Tracks] = track(keys, defaultEase, overrides);
  return out;
}

interface Pose {
  x: number; y: number; scale: number; rotate: number; opacity: number; blur: number;
  rotateX: number; rotateY: number; skew: number;
  /** Travel as a share of the layer's own height, for masks. */
  yShare: number;
  /** Clipped share of each side, 0..1: top, right, bottom, left. */
  clip: [number, number, number, number];
  /** For the camera: the screen point (px from the stage centre) its tilt turns about. */
  pivot?: [number, number];
  /** Px a slot move has carried the layer down (positive) or up (negative), clipped at its box. */
  slot?: number;
  /** An angled wipe: its direction in degrees, the share of the box still covered, and whether it is leaving. */
  cut?: { angle: number; hidden: number; leaving: boolean };
  /** A soft edge for masks and straight wipes: px, or true for a tenth of the line height. */
  feather?: number | true;
}
const rest = (): Pose => ({ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, blur: 0, rotateX: 0, rotateY: 0, skew: 0, yShare: 0, clip: [0, 0, 0, 0] });

/**
 * The side a wipe clips, as an index into Pose.clip (top, right, bottom, left). The edge
 * travels in the named direction: wipe-right uncovers from the left edge rightwards, so on
 * the way in the clip sits on the right and shrinks; on the way out it grows from the left.
 */
export function wipeSide(move: string, leaving: boolean): 0 | 1 | 2 | 3 {
  const sides: Record<string, [0 | 1 | 2 | 3, 0 | 1 | 2 | 3]> = {
    'wipe-up': [0, 2], 'wipe-down': [2, 0], 'wipe-left': [3, 1], 'wipe-right': [1, 3],
  };
  return sides[move]![leaving ? 1 : 0];
}

function applyMove(p: Pose, m: ResolvedMove, k: number, leaving: boolean) {
  // `gone` is how far from rest: 1 before an entrance starts and after an exit ends.
  // The overshoot of a springy ease is kept (gone < 0), so things can pass their mark.
  const gone = leaving ? k : 1 - k;
  const g = Math.max(0, Math.min(1, gone));
  const amount = m.amount ?? 0;
  const dir = leaving ? -1 : 1;
  const fades = !m.move.startsWith('mask-') && !m.move.startsWith('wipe') && m.move !== 'slot-up';
  const rad = ((m.angle ?? 0) * Math.PI) / 180, ux = Math.cos(rad), uy = Math.sin(rad);
  if (m.feather !== undefined && g > 0) p.feather = m.feather;
  if (fades) p.opacity *= m.move === 'pop' || m.move === 'swing' || m.move === 'pop-check' ? 1 - Math.min(1, g * 2.5) : 1 - g;
  switch (m.move) {
    case 'rise': p.y += dir * gone * amount; break;
    case 'drop': p.y -= dir * gone * amount; break;
    case 'slide-left': p.x += dir * gone * amount; break;
    case 'slide-right': p.x -= dir * gone * amount; break;
    case 'scale': case 'pop': p.scale *= 1 - gone * amount; break;
    case 'zoom': p.scale *= 1 + gone * amount; break;
    case 'blur': p.blur += g * amount; break;
    case 'focus': p.blur += g * amount * 0.5; p.y += dir * gone * amount; break;
    // A mask keeps going the way it came: in from below, out through the top.
    case 'mask-up': p.yShare += gone * (leaving ? -1 : 1); break;
    case 'mask-down': p.yShare += gone * (leaving ? 1 : -1); break;
    // A wipe's edge travels in the named direction, uncovering or covering.
    case 'wipe-up': case 'wipe-down': case 'wipe-left': case 'wipe-right': {
      const side = wipeSide(m.move, leaving);
      p.clip[side] = Math.max(p.clip[side], g);
      break;
    }
    // Along any angle: the edge, and the layer by `amount`, travel that way, in and out.
    case 'wipe': {
      p.cut = { angle: m.angle ?? 0, hidden: g, leaving };
      p.x -= dir * gone * amount * ux; p.y -= dir * gone * amount * uy;
      break;
    }
    case 'slide': p.x -= dir * gone * amount * ux; p.y -= dir * gone * amount * uy; break;
    case 'swing': p.rotateX += dir * gone * amount; break;
    // A check arriving: small, turned back and soft, then past its mark and home.
    case 'pop-check': p.scale *= 1 - gone * amount; p.rotate -= gone * 80; p.blur += g * 4; break;
    // Into its slot from below, out of it through the top: the box stays where it is.
    case 'slot-up': { const d = gone * amount * (leaving ? -1 : 1); p.y += d; p.slot = (p.slot ?? 0) + d; break; }
    default: break;
  }
}

function writePose(el: HTMLElement, p: Pose, depth: number, smear = '') {
  const flat = p.rotateX === 0 && p.rotateY === 0;
  const still = p.x === 0 && p.y === 0 && p.scale === 1 && p.rotate === 0 && p.skew === 0 && p.yShare === 0 && !p.slot && flat;
  const parts: string[] = [];
  if (!flat) parts.push(`perspective(${depth}px)`);
  // A framing camera turns in depth about its anchor, so the framed point stays where it is.
  const pivot = !flat && p.pivot ? p.pivot : undefined;
  if (pivot) parts.push(`translate(${pivot[0]}px, ${pivot[1]}px) rotateX(${p.rotateX}deg) rotateY(${p.rotateY}deg) translate(${-pivot[0]}px, ${-pivot[1]}px)`);
  // A mask travels its own height plus the room above and below it, so the
  // line is fully out of the window before the move starts.
  if (p.yShare !== 0) parts.push(`translateY(calc(${p.yShare * 100}% + ${p.yShare * 2} * ${MASK_PAD}))`);
  parts.push(`translate(${p.x}px, ${p.y}px)`);
  if (!flat && !pivot) parts.push(`rotateX(${p.rotateX}deg) rotateY(${p.rotateY}deg)`);
  parts.push(`rotate(${p.rotate}deg)`);
  if (p.skew !== 0) parts.push(`skewX(${p.skew}deg)`);
  parts.push(`scale(${p.scale})`);
  el.style.transform = still ? '' : parts.join(' ');
  el.style.opacity = p.opacity >= 1 ? '' : String(Math.max(0, p.opacity));
  el.style.filter = [smear, p.blur > 0.01 ? `blur(${p.blur}px)` : ''].filter(Boolean).join(' ');
  // A feathered mask or wipe fades its edge out with a mask image instead of cutting it.
  const soft = p.feather !== undefined && !p.cut && !p.slot && (Math.abs(p.yShare) > 1e-6 || p.clip.some((v) => v > 1e-4));
  if (soft) {
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 16, padVar = cs.getPropertyValue('--m-mask-pad').trim();
    const pad = padVar.endsWith('px') ? parseFloat(padVar) : (padVar.endsWith('em') ? parseFloat(padVar) : 0.3) * fs;
    const lh = parseFloat(cs.lineHeight) || fs * 1.2;
    const m = featherMask(p, el.offsetWidth, el.offsetHeight, pad, p.feather === true ? lh / 10 : p.feather!);
    el.style.clipPath = '';
    el.style.maskImage = m.image; el.style.maskSize = m.size; el.style.maskPosition = m.position;
    el.style.maskRepeat = 'no-repeat'; el.style.maskComposite = 'intersect'; el.style.setProperty('mask-clip', 'no-clip');
    return;
  }
  if (el.style.maskImage) for (const k of ['mask-image', 'mask-size', 'mask-position', 'mask-repeat', 'mask-composite', 'mask-clip']) el.style.removeProperty(k);
  // An angled wipe cuts in the layer's own px, so it needs the box's size (untransformed).
  el.style.clipPath = clipFor(p, p.cut && p.cut.hidden > 0 ? [el.offsetWidth, el.offsetHeight] : undefined);
}

/**
 * The mask for a feathered mask or wipe on a w × h box: the same window `clipFor` cuts, with
 * each edge fading out over `f` px beyond it rather than cut, so a line rises out of a soft
 * edge. A wipe's edge travels its share of the box plus the feather, so it starts and ends
 * fully off the box: nothing changes the frame the move ends and the mask comes off. The
 * image spans well past the box so overhangs, accents and italics are not cut.
 */
export function featherMask(p: Pick<Pose, 'clip' | 'yShare'>, w: number, h: number, pad: number, f: number): { image: string; size: string; position: string } {
  const X = Math.max(w, h) + pad + f, [t, r, b, l] = p.clip;
  let top = -X + f, bottom = h + X - f, left = -X + f, right = w + X - f;
  if (Math.abs(p.yShare) > 1e-6) {
    // The mask's window, fixed on stage, in the layer's own px as the layer travels through it.
    const travel = p.yShare * (h + 2 * pad);
    top = -pad - travel; bottom = h + pad - travel;
  }
  // A wipe's covered share, with the ramp carried past the box at either end of the move.
  if (t > 1e-4) top = Math.max(top, t * (h + f));
  if (b > 1e-4) bottom = Math.min(bottom, h - b * (h + f));
  if (l > 1e-4) left = Math.max(left, l * (w + f));
  if (r > 1e-4) right = Math.min(right, w - r * (w + f));
  const px = (v: number) => `${(v + X).toFixed(2)}px`;
  const ramp = (dir: string, a: number, z: number) =>
    z <= a ? `linear-gradient(${dir}, transparent, transparent)` : `linear-gradient(${dir}, transparent ${px(a - f)}, #000 ${px(a)}, #000 ${px(z)}, transparent ${px(z + f)})`;
  return {
    image: `${ramp('to bottom', top, bottom)}, ${ramp('to right', left, right)}`,
    size: `${(w + 2 * X).toFixed(2)}px ${(h + 2 * X).toFixed(2)}px`,
    position: `${(-X).toFixed(2)}px ${(-X).toFixed(2)}px`,
  };
}

/**
 * Room a mask leaves above and below the layer's box, for ascenders, accents,
 * descenders and old-style figures that reach past the line. A stylesheet can
 * change it with `--m-mask-pad` on the layer.
 */
const MASK_PAD = 'var(--m-mask-pad, 0.3em)';

/**
 * The most a placed layer without its own width may run: on a still stage, the room its
 * anchor leaves; on a canvas the camera travels, no limit, since a rule or a picture
 * there is meant to run past the stage's edge.
 */
export const placedMaxWidth = (place: Parameters<typeof placedRoom>[0], canvas: boolean, stageWidth: number): string =>
  canvas ? 'none' : `${(placedRoom(place) / 100) * stageWidth}px`;

/** Where an artboard sits on the stage: its scale, and the stage px of its top-left corner. */
export function artboardFit(stage: [number, number], board: Pick<Artboard, 'width' | 'height' | 'fit' | 'align'>): { scale: number; x: number; y: number } {
  const [W, H] = stage, sw = W / board.width, sh = H / board.height;
  const fit = board.fit ?? 'cover';
  const scale = fit === 'contain' ? Math.min(sw, sh) : fit === 'width' ? sw : fit === 'height' ? sh : Math.max(sw, sh);
  const [ax, ay] = board.align ?? [50, 50];
  return { scale, x: ((W - board.width * scale) * ax) / 100 || 0, y: ((H - board.height * scale) * ay) / 100 || 0 };
}

/**
 * What an angled wipe leaves showing of a w × h box, as a polygon in the box's px: the box,
 * less any straight wipes (`inset`, shares of top, right, bottom, left), cut by a line square
 * to `angle`. Entering, the line runs from the box's trailing corner to its leading one and
 * shows what it has passed; leaving, it hides what it has passed. `hidden` is the share of
 * the sweep still to come, or already gone.
 */
export function cutPolygon(w: number, h: number, inset: [number, number, number, number], cut: NonNullable<Pose['cut']>): [number, number][] {
  const [t, r, b, l] = inset;
  const rad = (cut.angle * Math.PI) / 180, ux = Math.cos(rad), uy = Math.sin(rad);
  const s = (x: number, y: number) => x * ux + y * uy;
  const proj = [s(0, 0), s(w, 0), s(w, h), s(0, h)];
  const lo = Math.min(...proj), hi = Math.max(...proj);
  const c = lo + (cut.leaving ? cut.hidden : 1 - cut.hidden) * (hi - lo);
  // Signed distance past the line: kept where it is <= 0.
  // Points within a hair of the line count as on it, so a corner on the line is kept once.
  const side = (x: number, y: number) => { const d = cut.leaving ? c - s(x, y) : s(x, y) - c; return Math.abs(d) < 1e-6 ? 0 : d; };
  const box: [number, number][] = [[l * w, t * h], [(1 - r) * w, t * h], [(1 - r) * w, (1 - b) * h], [l * w, (1 - b) * h]];
  const out: [number, number][] = [];
  for (let i = 0; i < box.length; i++) {
    const a = box[i]!, z = box[(i + 1) % box.length]!, da = side(a[0], a[1]), dz = side(z[0], z[1]);
    if (da <= 0) out.push(a);
    if ((da < 0 && dz > 0) || (da > 0 && dz < 0)) {
      const k = da / (da - dz);
      out.push([a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k]);
    }
  }
  // A corner or an edge alone shows nothing.
  return out.length < 3 ? [] : out;
}

/** The clip-path for a pose's wipes and masks, or '' when nothing is clipped. `size` is the box, needed for an angled wipe. */
export function clipFor(p: Pick<Pose, 'clip' | 'yShare' | 'slot' | 'cut'>, size?: [number, number]): string {
  const [t, r, b, l] = p.clip;
  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
  if (p.cut && p.cut.hidden > 0 && size && Math.abs(p.yShare) < 1e-6) {
    const pts = cutPolygon(size[0], size[1], p.clip, p.cut);
    return pts.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(', ')})`;
  }
  const slot = p.slot ?? 0;
  if (Math.abs(p.yShare) < 1e-6 && Math.abs(slot) > 1e-3) {
    // A slot move: the layer has travelled `slot` px; what passed the box's edge is cut off.
    const px = (wipe: number, by: number) => (by > 0 ? (wipe > 0.0001 ? `max(${pct(wipe)}, ${by.toFixed(2)}px)` : `${by.toFixed(2)}px`) : pct(wipe));
    return `inset(${px(t, -slot)} ${pct(r)} ${px(b, slot)} ${pct(l)})`;
  }
  if (Math.abs(p.yShare) < 1e-6) {
    // Wipes clip at the box itself: their edge is the move.
    return t + r + b + l > 0.0001 ? `inset(${pct(t)} ${pct(r)} ${pct(b)} ${pct(l)})` : '';
  }
  // A mask is a window from MASK_PAD above the box to MASK_PAD below it, fixed
  // on stage. The layer travels through it, so in the layer's own space the
  // window moves back by the travel. Sides are left open, so italics and
  // overhangs are not cut. When the move ends the clip is removed: everything
  // inside the padding was already showing, so nothing jumps.
  const y = Math.abs(p.yShare), travel = `(${(y * 100).toFixed(3)}% + ${(y * 2).toFixed(4)} * ${MASK_PAD})`;
  const near = `calc(${travel} - ${MASK_PAD})`, far = `calc(-1 * ${MASK_PAD})`;
  const [mTop, mBottom] = p.yShare > 0 ? [far, near] : [near, far];
  const edge = (wipe: number, mask: string) => (wipe > 0.0001 ? `max(${pct(wipe)}, ${mask})` : mask);
  const side = (wipe: number) => (wipe > 0.0001 ? pct(wipe) : '-100%');
  return `inset(${edge(t, mTop)} ${side(r)} ${edge(b, mBottom)} ${side(l)})`;
}

/** Seconds a layout glide takes, and its curve: quick away, a long settle. */
const GLIDE = 0.45;
const glideEase = resolveEase([0.22, 1, 0.36, 1]);

/** A layer's shutter: `true` is the film-standard half frame, a number is the share of a frame. */
const shutterOf = (v: unknown): number => (v === true ? 0.5 : typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : 0);

/** White or near-black, whichever has more contrast against the colour. */
function readableOn(colour: string, probe: HTMLElement): string {
  const canvas = probe.ownerDocument.createElement('canvas');
  canvas.width = canvas.height = 1;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  if (!c) return '#FFFFFF';
  c.fillStyle = colour;
  c.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = c.getImageData(0, 0, 1, 1).data;
  const lin = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Contrast against white is (1.05)/(L+0.05); against near-black about (L+0.05)/0.06.
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.06 ? '#FFFFFF' : '#14161A';
}

export function mount(host: HTMLElement, source: Film, options: MountOptions = {}): Mounted {
  const doc = host.ownerDocument;
  ensureCss(doc);

  const { film: tuned, orphans } = applyTune(source, options.tune);
  // A ui theme on the page supplies the interface timings and curves; the film's own tokens still win.
  const ui = readUiTokens(host);
  const film: Film = { ...tuned, tokens: merge(ui.tokens, tuned.tokens) };
  const res = resolveFilm(film);
  if (!res.timeline) throw new FilmError(res.issues);
  const { timeline, tokens } = res;
  const [W, H] = timeline.size;

  const stage = doc.createElement('div');
  stage.className = 'm-stage';
  stage.style.width = `${W}px`;
  stage.style.height = `${H}px`;
  stage.style.setProperty('--m-u', `${W / 100}px`);
  if (film.theme?.ui) {
    ensureUiTheme(doc, film.theme.ui);
    stage.dataset.uiTheme = film.theme.ui;
    // The theme's tokens follow the colour scheme; pin it, so a render never follows the machine's.
    stage.style.colorScheme = film.theme.scheme ?? 'light';
  }
  if (film.theme?.scheme) stage.style.colorScheme = film.theme.scheme;
  if (film.theme?.accent) {
    const accent = film.theme.accent;
    stage.style.setProperty('--m-bg-accent', accent);
    stage.style.setProperty('--m-accent', accent);
    stage.style.setProperty('--m-text-on-accent', film.theme.onAccent ?? readableOn(accent, stage));
  }
  for (const [k, v] of Object.entries(film.theme?.vars ?? {})) stage.style.setProperty(k, v);
  if (film.title) { stage.setAttribute('role', 'img'); stage.setAttribute('aria-label', film.title); }

  const ctx: Ctx = {
    tokens, seed: film.seed ?? 1, size: [W, H], fps: timeline.fps, easeOverrides: ui.ease, slots: options.slots ?? {},
    ease: (spec) => resolveEase(spec, ui.ease),
    ...(timeline.tempo ? { beat: 60 / timeline.tempo.bpm } : {}),
    cameraScale: () => drawingScale,
    cameraPose: () => drawingPose,
  };
  let drawingPose = { scale: 1, rotateX: 0, rotateY: 0 };
  /** A layer's smaller copies of its footage, pulled as "<key>@1", "<key>@2", …, largest first. */
  const mipsOf = (key: string): FrameSequence[] => {
    const out: FrameSequence[] = [];
    for (let k = 1; options.frames?.[`${key}@${k}`]; k++) out.push(options.frames[`${key}@${k}`]!);
    return out;
  };
  /** The camera scale of the scene being drawn, set before its layers seek. */
  let drawingScale = 1;

  // The stage must be in the page before primitives build: some of them measure text.
  host.appendChild(stage);
  let observer: ResizeObserver | undefined;
  if (options.fixed) host.style.cssText += `;width:${W}px;height:${H}px`;
  else {
    host.style.aspectRatio = `${W} / ${H}`;
    host.style.overflow = 'hidden';
    const fit = () => { stage.style.transform = `scale(${host.clientWidth / W})`; };
    fit();
    observer = new ResizeObserver(fit);
    observer.observe(host);
  }

  const scenes: LiveScene[] = timeline.scenes.map((spec, i) => {
    const s = spec.source;
    const el = doc.createElement('section');
    el.className = 'm-scene';
    el.dataset.scene = spec.id;
    el.style.zIndex = String(i + 1);
    if (s.scheme) el.style.colorScheme = s.scheme;
    const bg = s.background ?? 'base';
    el.style.background = SURFACE.has(bg) ? `var(--m-bg-${bg})` : bg;
    if (bg === 'inverse') el.style.color = 'var(--m-text-inverse)';
    if (bg === 'accent') el.style.color = 'var(--m-text-on-accent)';
    const cam = doc.createElement('div');
    cam.className = 'm-cam';
    const lay = s.layout ?? {};
    cam.style.alignItems = FLEX[lay.align ?? 'center']!;
    cam.style.justifyContent = FLEX[lay.justify ?? 'center']!;
    cam.style.textAlign = lay.align === 'start' ? 'left' : lay.align === 'end' ? 'right' : 'center';
    if (lay.gap !== undefined) cam.style.gap = `${lay.gap}px`;
    if (lay.padding !== undefined) cam.style.padding = `${lay.padding}px`;
    el.appendChild(cam);
    stage.appendChild(el);

    // A scene whose camera moves is a canvas the camera travels over.
    const frame = s.artboard ?? { width: W, height: H };
    const fit = artboardFit([W, H], frame);
    let board: HTMLElement | undefined;
    const canvas = !!s.follow || !!spec.camera || (['x', 'y', 'scale', 'rotate', 'rotateX', 'rotateY'] as const).some((k) => (s.tracks?.[k]?.length ?? 0) > 1);
    const layers: LiveLayer[] = spec.layers.map((layer) => {
      const le = doc.createElement('div');
      le.className = 'm-layer';
      le.dataset.layer = layer.id;
      const st = layer.source.style ?? {};
      le.dataset.size = st.size ?? 'title';
      if (st.color) le.style.color = st.color === 'accent' ? 'var(--m-accent)' : `var(--m-text-${st.color})`;
      if (st.font) le.style.fontFamily = `var(--m-font-${st.font})`;
      if (st.weight !== undefined) le.style.fontWeight = String(st.weight);
      if (st.align) le.style.textAlign = st.align;
      const place = layer.source.place;
      const onBoard = place?.unit === 'px';
      // style.width is a share of the stage, or on an artboard, of the artboard.
      if (st.width !== undefined) le.style.maxWidth = `${(st.width / 100) * (onBoard ? frame.width : W)}px`;
      if (place) {
        le.style.position = 'absolute';
        le.style.left = `${place.x}${onBoard ? 'px' : '%'}`;
        le.style.top = `${place.y}${onBoard ? 'px' : '%'}`;
        le.style.translate = ANCHOR[place.anchor ?? 'center']!;
        // An absolute box shrinks to the room right of its `left`, so a centred
        // headline would wrap at half the stage. Size it to its content instead,
        // up to style.width, or else up to the room its anchor leaves on stage.
        // Not on a canvas, though: where the scene's camera moves, layers lie beyond the
        // stage on purpose, and the stage's edge is no limit on how wide they are.
        le.style.width = 'max-content';
        // On an artboard the design sets the sizes, not the stage.
        if (st.width === undefined) le.style.maxWidth = onBoard ? 'none' : placedMaxWidth(place, canvas, W);
      }
      for (const [k, v] of Object.entries(st.css ?? {})) le.style.setProperty(k, v);
      // Layers placed in px sit on the artboard. A run of them shares one; a layer on the
      // stage in between starts a new one, so they stack in the order they are written.
      if (onBoard) {
        if (!board || cam.lastElementChild !== board) {
          board = doc.createElement('div');
          board.className = 'm-artboard';
          board.style.cssText = `position:absolute;left:${fit.x}px;top:${fit.y}px;width:${frame.width}px;height:${frame.height}px;transform-origin:0 0;transform:scale(${fit.scale})`;
          cam.appendChild(board);
        }
        board.appendChild(le);
      } else if (layer.source.screen) {
        // Fixed to the screen: a sibling of the camera, never moved by it. Written before every
        // camera layer it lies under the camera (a fixed backdrop); otherwise over it (a vignette).
        le.style.position = le.style.position || 'absolute';
        if (!place) le.style.inset = '0';
        le.classList.add('m-screen');
        if (cam.childElementCount === 0) el.insertBefore(le, cam); else el.appendChild(le);
      } else cam.appendChild(le);
      const frames = options.frames?.[`${spec.id}/${layer.id}`];
      const instance = PRIMITIVES[layer.use]!.build(le, layer.props, layer.params, { ...ctx, ...(frames ? { frames } : {}), filmStart: spec.start + layer.start, boxOf: (id) => boxOf(spec.id, id), mips: mipsOf(`${spec.id}/${layer.id}`) });
      return {
        spec: layer, el: le, instance, tracks: samplers(layer.source.tracks, tokens.ease_move, ui.ease),
        ease: { ...(layer.enter ? { enter: ctx.ease(layer.enter.ease) } : {}), ...(layer.exit ? { exit: ctx.ease(layer.exit.ease) } : {}) },
        shutter: shutterOf(layer.source.motionBlur), unit: onBoard ? fit.scale : 1,
        // A tap on a mark of footage is already pressed in the footage: only its ring is drawn.
        ...(layer.taps?.some((t) => !t.mark) ? { taps: layer.taps.filter((t) => !t.mark).map((t) => t.t) } : {}),
      };
    });
    // Taps' rings, one per layer they are drawn around.
    const rings: LiveRing[] = [];
    for (const l of layers) for (const tap of l.spec.taps ?? []) {
      const target = tap.ring === null ? undefined : layers.find((o) => o.spec.id === tap.ring);
      if (!target) continue;
      let ring = rings.find((r) => r.target === target && r.mark === tap.mark);
      if (!ring) {
        const re = doc.createElement('div');
        re.className = 'm-ring';
        re.style.cssText = `position:absolute;pointer-events:none;box-sizing:border-box;border:${1.5 / target.unit}px solid var(--m-accent);opacity:0`;
        target.el.parentElement!.appendChild(re);
        rings.push((ring = { target, el: re, taps: [], ...(tap.mark ? { mark: tap.mark } : {}) }));
      }
      ring.taps.push(tap.t);
    }
    const live: LiveScene = { spec, el, cam, layers, tracks: samplers(s.tracks, tokens.ease_move, ui.ease), handover: false, homes: new Map(),
      depth: s.perspective ?? W * 1.2, shutter: shutterOf(s.motionBlur), rings };
    reflow(live);
    aim(live);
    shape(live);
    const f = s.follow, target = f ? layers.find((l) => l.spec.id === f.layer) : undefined;
    if (f && target?.instance.tip) {
      // Where the layer's box sits in the camera's world, measured once while nothing is moved.
      const k = stage.getBoundingClientRect().width / W || 1;
      const a = target.el.getBoundingClientRect(), c = cam.getBoundingClientRect();
      live.follow = {
        layer: target, origin: [(a.left - c.left) / k, (a.top - c.top) / k],
        at: [((f.at?.[0] ?? 50) / 100) * W, ((f.at?.[1] ?? 50) / 100) * H], lag: f.lag ?? 0, blend: f.blend ?? 0.6,
        // A layer on an artboard draws its tip, and travels, in the design's pixels.
        scale: target.spec.source.place?.unit === 'px' ? fit.scale : 1,
      };
    }
    return live;
  });

  const last = scenes[scenes.length - 1]!;

  /**
   * Aims a scene's framing camera. Every layer's box is measured where layout put it, with
   * nothing moved: no camera, no enter move, no hand-over. So the camera aims at where a thing
   * sits, never at where its animation happens to carry it, and a layer not yet in, or already
   * gone, is framed where it will be or was (hidden layers keep their room). Layout does not
   * change after build, so this is done once, and again when the fonts have loaded.
   */
  function aim(scene: LiveScene) {
    const keys = scene.spec.camera;
    if (!keys) return;
    const world = unmoved(scene, () => {
      const c = scene.cam.getBoundingClientRect(), k = c.width / W || 1;
      return new Map(scene.layers.map((l) => {
        const r = l.el.getBoundingClientRect();
        return [l.spec.id, { x: (r.left - c.left) / k, y: (r.top - c.top) / k, w: r.width / k, h: r.height / k }] as const;
      }));
    });
    scene.frame = keys.map((key) => {
      let box = typeof key.frame === 'string' ? world.get(key.frame.split('#')[0]!) : undefined;
      if (box && typeof key.frame === 'string' && key.frame.includes('#')) {
        // A mark in a footage plane's picture, where it is at the key's moment.
        const [lid, mark] = key.frame.split('#') as [string, string];
        const layer = scene.layers.find((l) => l.spec.id === lid), m = layer?.instance.markAt?.(mark, key.t - layer.spec.start);
        if (m) box = { x: box.x + m[0], y: box.y + m[1], w: m[2], h: m[3] };
      }
      const target: [number, number] = box
        ? [box.x + key.point[0] * box.w + key.offset[0], box.y + key.point[1] * box.h + key.offset[1]]
        : [((key.frame as [number, number])[0] / 100) * W + key.offset[0], ((key.frame as [number, number])[1] / 100) * H + key.offset[1]];
      return {
        t: key.t, target, zoom: key.zoom, anchor: [(key.anchor[0] / 100) * W, (key.anchor[1] / 100) * H], tilt: key.tilt, rotate: key.rotate,
        ease: ctx.ease(key.ease ?? tokens.ease_move), drift: key.drift,
      };
    });
  }

  /**
   * Measures each tap ring's target where layout put it, with nothing moved, and finds its
   * shape: the first element down a single-child chain with rounded corners (a button inside
   * its layer's box), so the ring follows the control, not the box around it.
   */
  function shape(scene: LiveScene) {
    if (!scene.rings.length) return;
    unmoved(scene, () => {
      for (const ring of scene.rings) {
        const parent = ring.el.parentElement!, pr = parent.getBoundingClientRect(), k = pr.width / (parent.offsetWidth || 1) || 1;
        let e: Element = ring.target.el;
        const radius = (x: Element) => parseFloat(getComputedStyle(x).borderTopLeftRadius) || 0;
        while (!ring.mark && radius(e) === 0 && e.children.length === 1) e = e.firstElementChild!;
        if (radius(e) === 0) e = ring.target.el;
        const r = e.getBoundingClientRect(), w = r.width / k, h = r.height / k;
        ring.box = { x: (r.left - pr.left) / k, y: (r.top - pr.top) / k, w, h, radius: Math.min(radius(e), Math.min(w, h) / 2) };
      }
    });
  }

  /**
   * Layout glides. A glide layer takes no room until it starts and gives it up when its exit
   * starts. The page stays laid out with every layer in place, so nothing re-wraps; instead each
   * layout the scene passes through is measured once here (glide layers taken out with
   * display: none), and the layers are moved between them by transforms over GLIDE seconds.
   */
  function reflow(scene: LiveScene) {
    const glides = scene.layers.filter((l) => l.spec.source.reflow === 'glide' && !l.spec.source.place && !l.spec.source.screen);
    if (!glides.length) { delete scene.glide; return; }
    const events = glides.flatMap((g) => [
      { t: g.spec.start, g, on: true },
      ...(g.spec.exit ? [{ t: g.spec.exit.start, g, on: false }] : []),
    ]).sort((a, b) => a.t - b.t);
    scene.glide = unmoved(scene, () => {
      const display = new Map(scene.layers.map((l) => [l, l.el.style.display] as const));
      const c = () => scene.cam.getBoundingClientRect();
      const measure = (present: Set<LiveLayer>) => {
        for (const g of glides) g.el.style.display = present.has(g) ? display.get(g)! : 'none';
        const cr = c(), k = cr.width / W || 1;
        return new Map(scene.layers.map((l) => {
          const r = l.el.getBoundingClientRect();
          return [l, [(r.left - cr.left) / k, (r.top - cr.top) / k] as [number, number]] as const;
        }));
      };
      const diff = (a: Map<LiveLayer, [number, number]>, b: Map<LiveLayer, [number, number]>) =>
        new Map(scene.layers.map((l) => [l, [(a.get(l)![0] - b.get(l)![0]) / l.unit, (a.get(l)![1] - b.get(l)![1]) / l.unit] as [number, number]] as const));
      const full = measure(new Set(glides));
      const present = new Set<LiveLayer>();
      let prev = measure(present);
      const base = diff(prev, full);
      const steps = events.map((e) => {
        if (e.on) present.add(e.g); else present.delete(e.g);
        const next = measure(present), delta = diff(next, prev);
        prev = next;
        return { t: e.t, delta };
      });
      for (const g of glides) g.el.style.display = display.get(g)!;
      return { base, steps };
    });
  }

  /** Layout boxes other layers asked for, by scene and layer id; cleared when the fonts load. */
  const boxes = new Map<string, { x: number; y: number; w: number; h: number } | undefined>();
  function boxOf(sceneId: string, id: string) {
    const key = `${sceneId}/${id}`;
    if (boxes.has(key)) return boxes.get(key);
    const scene = scenes.find((x) => x.spec.id === sceneId), layer = scene?.layers.find((l) => l.spec.id === id);
    const box = scene && layer ? unmoved(scene, () => {
      const c = scene.cam.getBoundingClientRect(), k = c.width / W || 1, r = layer.el.getBoundingClientRect();
      return { x: (r.left - c.left) / k, y: (r.top - c.top) / k, w: r.width / k, h: r.height / k };
    }) : undefined;
    boxes.set(key, box);
    return box;
  }

  /** Runs `measure` with the scene, its camera and its layers unmoved and the scene laid out. */
  function unmoved<T>(scene: LiveScene, measure: () => T): T {
    const moved = [scene.el, scene.cam, ...scene.layers.map((l) => l.el)];
    const was = moved.map((e) => [e.style.transform, e.style.display] as const);
    for (const e of moved) e.style.transform = 'none';
    scene.el.style.display = '';
    try { return measure(); } finally { moved.forEach((e, i) => { e.style.transform = was[i]![0]; e.style.display = was[i]![1]; }); }
  }

  let lastSeek = 0;
  function seek(time: number) {
    const t = clamp(time, 0, timeline.duration);
    lastSeek = t;
    // First take off every finished hand-over's styles, including on scenes not on
    // screen. It must come before this frame's hand-overs are drawn: a scene can be
    // the incoming side of one transition and the outgoing side of the next, and
    // clearing the old one afterwards would wipe what the new one just wrote.
    scenes.forEach((scene, i) => {
      const next = scenes[i + 1];
      if (!scene.handover || !next || !scene.spec.out) return;
      if (t >= next.spec.start && t < scene.spec.end && scene.spec.out.duration > 0) return;
      const tr = TRANSITIONS[scene.spec.out.use]!;
      tr.clear(scene.el);
      tr.clear(next.el);
      scene.handover = false;
    });
    scenes.forEach((scene, i) => {
      const { spec } = scene;
      const on = t >= spec.start && (t < spec.end || scene === last);
      scene.el.style.visibility = on ? 'visible' : 'hidden';
      // Off-screen scenes leave rendering entirely: some content (blend modes, SVG
      // filters) still paints under visibility: hidden. Layout was measured at build.
      scene.el.style.display = on ? '' : 'none';
      if (!on) return;
      const local = t - spec.start;

      const cam = camAt(scene, local);
      // Motion blur on the camera: the frame's travel over half a frame either side, along the
      // pan, plus the zoom's spread at a third of the way to the corner, which a round blur stands in for.
      let camSmear = '';
      if (scene.shutter > 0) {
        const h = 0.5 / timeline.fps, a = camAt(scene, local - h), b = camAt(scene, local + h);
        const spread = Math.abs(Math.log(b.scale / a.scale)) * Math.hypot(W, H) / 6;
        camSmear = directionalBlur(scene.cam, Math.hypot(streak(b.x - a.x, scene.shutter), streak(spread, scene.shutter)), Math.hypot(streak(b.y - a.y, scene.shutter), streak(spread, scene.shutter)));
      }
      writePose(scene.cam, cam, scene.depth, camSmear);
      const posed = new Map<LiveLayer, Pose>();
      drawingScale = Math.abs(cam.scale) || 1;
      drawingPose = { scale: drawingScale, rotateX: cam.rotateX, rotateY: cam.rotateY };

      for (const layer of scene.layers) {
        const l = layer.spec;
        const lt = local - l.start;
        const gone = lt < 0 || (l.exit !== undefined && local >= l.exit.start + l.exit.duration);
        layer.el.style.visibility = gone ? 'hidden' : 'inherit';
        if (gone) continue;
        layer.instance.seek(lt);
        const pose = poseAt(layer, local, scene, cam);
        // Motion blur: the layer's speed from the poses half a frame either side,
        // smeared along its path only, and gone the moment it stops.
        let smear = '';
        if (layer.shutter > 0) {
          const h = 0.5 / timeline.fps, a = poseAt(layer, local - h, scene), b = poseAt(layer, local + h, scene);
          smear = directionalBlur(layer.el, streak(b.x - a.x, layer.shutter), streak(b.y - a.y, layer.shutter));
        }
        writePose(layer.el, pose, W * 0.8, smear);
        // Inside a zoomed camera, a part without its own compositor layer is painted at whole CSS px
        // of the camera's space, so a slow move steps by the zoom (4 px at 4×). While it moves there,
        // it gets a layer of its own and lands where its time puts it; at rest it is painted flat again.
        const prev = drawingScale >= 1.25 ? poseAt(layer, local - 1 / timeline.fps, scene, cam) : undefined;
        const moving = !!prev && (Math.abs(prev.x - pose.x) > 1e-3 || Math.abs(prev.y - pose.y) > 1e-3 || Math.abs(prev.scale - pose.scale) > 1e-5);
        if (moving) layer.el.style.setProperty('will-change', 'transform', 'important');
        else layer.el.style.removeProperty('will-change');
        posed.set(layer, pose);
      }

      // Rings leave their control's layout box, moved with it but never scaled by its press.
      for (const ring of scene.rings) {
        const r = ringAt(ring.taps, local), p = posed.get(ring.target);
        let b = ring.box;
        if (b && ring.mark) {
          // A mark: where it is in the footage now, inside the layer's box.
          const m = ring.target.instance.markAt?.(ring.mark, local - ring.target.spec.start);
          b = m ? { x: b.x + m[0], y: b.y + m[1], w: m[2], h: m[3], radius: Math.min(m[3] / 2, 14) } : undefined;
        }
        if (!r || !b || !p) { ring.el.style.opacity = '0'; continue; }
        const g = r.grow / ring.target.unit, st = ring.el.style;
        st.left = `${b.x + p.x - g}px`; st.top = `${b.y + p.y - g}px`;
        st.width = `${b.w + 2 * g}px`; st.height = `${b.h + 2 * g}px`;
        st.borderRadius = `${b.radius + g}px`; st.opacity = String(r.opacity * p.opacity);
      }

      // Hand-over: this scene is the outgoing one while the next has already started.
      const next = scenes[i + 1];
      const out = spec.out;
      if (out && next) {
        const active = t >= next.spec.start && t < spec.end && out.duration > 0;
        const tr = TRANSITIONS[out.use]!;
        // Finished hand-overs were cleared at the top of seek.
        if (active) {
          tr.apply(scene.el, next.el, (t - next.spec.start) / out.duration, out.params, ctx);
          scene.handover = true;
        }
      }
    });
  }

  /**
   * Moves the camera so the followed tip sits at its mark. The camera turns and
   * scales about the stage centre, so the translation that puts a world point P
   * at A is A − C − R·S·(P − C). Lag averages the tip over the last `lag`
   * seconds, which trails it smoothly; blend eases over from the scene's own
   * x and y tracks, starting when the layer does.
   */
  function follow(cam: Pose, f: LiveFollow, local: number) {
    const l = f.layer, lt = local - l.spec.start;
    const tipAt = (t: number) => l.instance.tip!(Math.max(0, t));
    let p = tipAt(lt);
    if (!p) return;
    if (f.lag > 0) {
      const n = 12;
      let sx = 0, sy = 0, m = 0;
      for (let i = 0; i <= n; i++) {
        const q = tipAt(lt - (f.lag * i) / n);
        if (q) { sx += q[0]; sy += q[1]; m++; }
      }
      if (m) p = [sx / m, sy / m];
    }
    // The layer's own travel (its enter move, its tracks) carries the tip with it.
    const own = poseAt(l, local);
    const P: [number, number] = [f.origin[0] + f.scale * (p[0] + own.x), f.origin[1] + f.scale * (p[1] + own.y)];
    const C: [number, number] = [W / 2, H / 2], r = (cam.rotate * Math.PI) / 180, s = cam.scale;
    const dx = P[0] - C[0], dy = P[1] - C[1];
    const tx = f.at[0] - C[0] - s * (Math.cos(r) * dx - Math.sin(r) * dy);
    const ty = f.at[1] - C[1] - s * (Math.sin(r) * dx + Math.cos(r) * dy);
    const w = f.blend > 0 ? ctx.ease('smooth')(clamp(lt / f.blend, 0, 1)) : lt >= 0 ? 1 : 0;
    cam.x += (tx - cam.x) * w;
    cam.y += (ty - cam.y) * w;
  }

  /** The scene's camera at `local` seconds: its tracks, then the follow. */
  function camAt(scene: LiveScene, local: number): Pose {
    const cam = rest();
    if (scene.frame) {
      const f = frameAt(scene.frame, local, [W, H]);
      Object.assign(cam, { x: f.x, y: f.y, scale: f.scale, rotate: f.rotate, rotateX: f.rotateX, rotateY: f.rotateY, pivot: f.pivot });
    }
    sample(cam, scene.tracks, local);
    if (scene.follow) follow(cam, scene.follow, local);
    return cam;
  }

  /**
   * Where a layer's enter, exit and tracks put it at `local` seconds into its scene, and with
   * the scene, its parallax: a layer at depth d moves d times the camera's travel since its
   * home time, so inside the camera it moves (d − 1) times it, in its own px.
   */
  function poseAt(layer: LiveLayer, local: number, scene?: LiveScene, cam?: Pose): Pose {
    const l = layer.spec, pose = rest();
    if (l.enter && layer.ease.enter) applyMove(pose, l.enter, progress(local, l.enter.start, l.enter.duration, layer.ease.enter), false);
    if (l.exit && layer.ease.exit && local >= l.exit.start) applyMove(pose, l.exit, progress(local, l.exit.start, l.exit.duration, layer.ease.exit), true);
    sample(pose, layer.tracks, local - l.start);
    if (layer.taps) pose.scale *= pressAt(layer.taps, local);
    if (scene?.glide) {
      const g = scene.glide, b = g.base.get(layer)!;
      let dx = b[0], dy = b[1];
      for (const step of g.steps) {
        if (local <= step.t) break;
        const k = progress(local, step.t, GLIDE, glideEase), d = step.delta.get(layer)!;
        dx += d[0] * k; dy += d[1] * k;
      }
      pose.x += dx; pose.y += dy;
    }
    const px = l.parallax;
    if (scene && px && px.depth !== 1) {
      const now = cam ?? camAt(scene, local);
      let home = scene.homes.get(px.home);
      if (!home) scene.homes.set(px.home, (home = camAt(scene, px.home)));
      const k = (px.depth - 1) / (layer.unit * (now.scale || 1));
      pose.x += k * (now.x - home.x);
      pose.y += k * (now.y - home.y);
    }
    return pose;
  }

  function sample(pose: Pose, s: Sampler, t: number) {
    if (s.x) pose.x += s.x(t);
    if (s.y) pose.y += s.y(t);
    if (s.scale) pose.scale *= s.scale(t);
    if (s.rotate) pose.rotate += s.rotate(t);
    if (s.opacity) pose.opacity *= s.opacity(t);
    if (s.blur) pose.blur += s.blur(t);
    if (s.rotateX) pose.rotateX += s.rotateX(t);
    if (s.rotateY) pose.rotateY += s.rotateY(t);
    if (s.skew) pose.skew += s.skew(t);
  }

  function audit(t: number): LayerBox[] {
    seek(t);
    const frame = stage.getBoundingClientRect();
    const k = frame.width > 0 ? W / frame.width : 1;
    const boxes: LayerBox[] = [];
    // A transition moves whole scenes off stage on purpose, so scenes in a hand-over are not audited.
    const moving = new Set<number>();
    scenes.forEach((s, i) => { if (s.handover) moving.add(i).add(i + 1); });
    for (const [i, scene] of scenes.entries()) {
      if (scene.el.style.visibility === 'hidden' || moving.has(i)) continue;
      for (const layer of scene.layers) {
        if (layer.el.style.visibility === 'hidden') continue;
        // Full-bleed layers (textures, fields) may bleed past the edge by design.
        const bleed = layer.el.offsetWidth >= W - 1 && layer.el.offsetHeight >= H - 1;
        const r = layer.el.getBoundingClientRect();
        const x = (r.left - frame.left) * k, y = (r.top - frame.top) * k, width = r.width * k, height = r.height * k;
        const round = (n: number) => Math.round(n * 10) / 10;
        boxes.push({
          scene: scene.spec.id, layer: layer.spec.id, use: layer.spec.use,
          x: round(x), y: round(y), width: round(width), height: round(height),
          off: bleed ? { left: 0, top: 0, right: 0, bottom: 0 } : { left: round(Math.max(0, -x)), top: round(Math.max(0, -y)), right: round(Math.max(0, x + width - W)), bottom: round(Math.max(0, y + height - H)) },
          empty: width < 1 || height < 1,
        });
      }
    }
    return boxes;
  }

  // Images a layer fills in later (a footage plane's copies) have no source yet: nothing to wait for.
  const images = [...stage.querySelectorAll('img')].filter((img) => img.getAttribute('src'));
  const videos = [...stage.querySelectorAll('video')];
  const ready = Promise.all([
    doc.fonts.ready,
    ...images.map((img) => img.decode().catch(() => { throw new Error(`Image did not load: ${img.getAttribute('src')}`); })),
    ...videos.map((v) => (v.readyState >= 2 ? Promise.resolve() : new Promise<void>((resolve, reject) => {
      v.addEventListener('loadeddata', () => resolve(), { once: true });
      v.addEventListener('error', () => reject(new Error(`Video did not load: ${v.getAttribute('src')}`)), { once: true });
    }))),
  ]).then(() => undefined);
  // Fonts change where text sits: aim the framing cameras again once they are in.
  void ready.then(() => { boxes.clear(); scenes.forEach((s) => { reflow(s); aim(s); shape(s); }); seek(lastSeek); }).catch(() => undefined);
  const settled = () => Promise.all(scenes.flatMap((s) => s.layers.map((l) => l.instance.pending?.()))).then(() => undefined);

  seek(0);
  return {
    film, timeline, tokens, issues: res.issues, orphans, duration: timeline.duration, fps: timeline.fps, stage, ready, seek, settled, audit,
    destroy() { observer?.disconnect(); stage.remove(); },
  };
}
