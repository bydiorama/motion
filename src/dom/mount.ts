// Draws a film into a page. Everything on screen is written by seek(t) from the
// film time alone, so frames can be drawn in any order and always come out the same.
import { clamp, progress, resolveEase, type Bezier, type EaseSpec } from '../core/ease.ts';
import { track } from '../core/track.ts';
import { resolveFilm } from '../film/resolve.ts';
import { applyTune } from '../film/tune.ts';
import type { Film, Issue, ResolvedLayer, ResolvedMove, ResolvedScene, Timeline, Tracks, Tune } from '../film/types.ts';
import { directionalBlur, streak } from '../primitives/blur.ts';
import { PRIMITIVES, TRANSITIONS } from '../primitives/index.ts';
import type { Ctx, Instance } from '../primitives/types.ts';
import { merge, type Tokens } from '../tokens.ts';
import { STAGE_CSS } from './stage.css.ts';
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
  /** Where every visible layer sits at time t. Seeks to t. */
  audit(t: number): LayerBox[];
  destroy(): void;
}

interface LiveLayer { spec: ResolvedLayer; el: HTMLElement; instance: Instance; tracks: Sampler; ease: { enter?: (x: number) => number; exit?: (x: number) => number }; shutter: number }
interface LiveScene { spec: ResolvedScene; el: HTMLElement; cam: HTMLElement; layers: LiveLayer[]; tracks: Sampler; handover: boolean }
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
}
const rest = (): Pose => ({ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, blur: 0, rotateX: 0, rotateY: 0, skew: 0, yShare: 0, clip: [0, 0, 0, 0] });

function applyMove(p: Pose, m: ResolvedMove, k: number, leaving: boolean) {
  // `gone` is how far from rest: 1 before an entrance starts and after an exit ends.
  // The overshoot of a springy ease is kept (gone < 0), so things can pass their mark.
  const gone = leaving ? k : 1 - k;
  const g = Math.max(0, Math.min(1, gone));
  const amount = m.amount ?? 0;
  const dir = leaving ? -1 : 1;
  const fades = !m.move.startsWith('mask-') && !m.move.startsWith('wipe-');
  if (fades) p.opacity *= m.move === 'pop' || m.move === 'swing' ? 1 - Math.min(1, g * 2.5) : 1 - g;
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
    case 'wipe-up': p.clip[leaving ? 2 : 0] = Math.max(p.clip[leaving ? 2 : 0], g); break;
    case 'wipe-down': p.clip[leaving ? 0 : 2] = Math.max(p.clip[leaving ? 0 : 2], g); break;
    case 'wipe-left': p.clip[leaving ? 3 : 1] = Math.max(p.clip[leaving ? 3 : 1], g); break;
    case 'wipe-right': p.clip[leaving ? 1 : 3] = Math.max(p.clip[leaving ? 1 : 3], g); break;
    case 'swing': p.rotateX += dir * gone * amount; break;
    default: break;
  }
}

function writePose(el: HTMLElement, p: Pose, depth: number, smear = '') {
  const flat = p.rotateX === 0 && p.rotateY === 0;
  const still = p.x === 0 && p.y === 0 && p.scale === 1 && p.rotate === 0 && p.skew === 0 && p.yShare === 0 && flat;
  const parts: string[] = [];
  if (!flat) parts.push(`perspective(${depth}px)`);
  // A mask travels its own height plus the room above and below it, so the
  // line is fully out of the window before the move starts.
  if (p.yShare !== 0) parts.push(`translateY(calc(${p.yShare * 100}% + ${p.yShare * 2} * ${MASK_PAD}))`);
  parts.push(`translate(${p.x}px, ${p.y}px)`);
  if (!flat) parts.push(`rotateX(${p.rotateX}deg) rotateY(${p.rotateY}deg)`);
  parts.push(`rotate(${p.rotate}deg)`);
  if (p.skew !== 0) parts.push(`skewX(${p.skew}deg)`);
  parts.push(`scale(${p.scale})`);
  el.style.transform = still ? '' : parts.join(' ');
  el.style.opacity = p.opacity >= 1 ? '' : String(Math.max(0, p.opacity));
  el.style.filter = [smear, p.blur > 0.01 ? `blur(${p.blur}px)` : ''].filter(Boolean).join(' ');
  el.style.clipPath = clipFor(p);
}

/**
 * Room a mask leaves above and below the layer's box, for ascenders, accents,
 * descenders and old-style figures that reach past the line. A stylesheet can
 * change it with `--m-mask-pad` on the layer.
 */
const MASK_PAD = 'var(--m-mask-pad, 0.3em)';

/** The clip-path for a pose's wipes and masks, or '' when nothing is clipped. */
export function clipFor(p: Pick<Pose, 'clip' | 'yShare'>): string {
  const [t, r, b, l] = p.clip;
  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
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
  };

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
      if (st.width !== undefined) le.style.maxWidth = `${(st.width / 100) * W}px`;
      const place = layer.source.place;
      if (place) {
        le.style.position = 'absolute';
        le.style.left = `${place.x}%`;
        le.style.top = `${place.y}%`;
        le.style.translate = ANCHOR[place.anchor ?? 'center']!;
        // An absolute box shrinks to the room right of its `left`, so a centred
        // headline would wrap at half the stage. Size it to its content instead,
        // up to style.width, or else up to the room its anchor leaves on stage.
        le.style.width = 'max-content';
        if (st.width === undefined) le.style.maxWidth = `${(placedRoom(place) / 100) * W}px`;
      }
      for (const [k, v] of Object.entries(st.css ?? {})) le.style.setProperty(k, v);
      cam.appendChild(le);
      const instance = PRIMITIVES[layer.use]!.build(le, layer.props, layer.params, ctx);
      return {
        spec: layer, el: le, instance, tracks: samplers(layer.source.tracks, tokens.ease_move, ui.ease),
        ease: { ...(layer.enter ? { enter: ctx.ease(layer.enter.ease) } : {}), ...(layer.exit ? { exit: ctx.ease(layer.exit.ease) } : {}) },
        shutter: shutterOf(layer.source.motionBlur),
      };
    });
    return { spec, el, cam, layers, tracks: samplers(s.tracks, tokens.ease_move, ui.ease), handover: false };
  });

  const last = scenes[scenes.length - 1]!;

  function seek(time: number) {
    const t = clamp(time, 0, timeline.duration);
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

      const cam = rest();
      sample(cam, scene.tracks, local);
      writePose(scene.cam, cam, W * 1.2);

      for (const layer of scene.layers) {
        const l = layer.spec;
        const lt = local - l.start;
        const gone = lt < 0 || (l.exit !== undefined && local >= l.exit.start + l.exit.duration);
        layer.el.style.visibility = gone ? 'hidden' : 'inherit';
        if (gone) continue;
        layer.instance.seek(lt);
        const pose = poseAt(layer, local);
        // Motion blur: the layer's speed from the poses half a frame either side,
        // smeared along its path only, and gone the moment it stops.
        let smear = '';
        if (layer.shutter > 0) {
          const h = 0.5 / timeline.fps, a = poseAt(layer, local - h), b = poseAt(layer, local + h);
          smear = directionalBlur(layer.el, streak(b.x - a.x, layer.shutter), streak(b.y - a.y, layer.shutter));
        }
        writePose(layer.el, pose, W * 0.8, smear);
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

  /** Where a layer's enter, exit and tracks put it at `local` seconds into its scene. */
  function poseAt(layer: LiveLayer, local: number): Pose {
    const l = layer.spec, pose = rest();
    if (l.enter && layer.ease.enter) applyMove(pose, l.enter, progress(local, l.enter.start, l.enter.duration, layer.ease.enter), false);
    if (l.exit && layer.ease.exit && local >= l.exit.start) applyMove(pose, l.exit, progress(local, l.exit.start, l.exit.duration, layer.ease.exit), true);
    sample(pose, layer.tracks, local - l.start);
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

  const images = [...stage.querySelectorAll('img')];
  const ready = Promise.all([
    doc.fonts.ready,
    ...images.map((img) => img.decode().catch(() => { throw new Error(`Image did not load: ${img.getAttribute('src')}`); })),
  ]).then(() => undefined);

  seek(0);
  return {
    film, timeline, tokens, issues: res.issues, orphans, duration: timeline.duration, fps: timeline.fps, stage, ready, seek, audit,
    destroy() { observer?.disconnect(); stage.remove(); },
  };
}
