// Draws a film into a page. Everything on screen is written by seek(t) from the
// film time alone, so frames can be drawn in any order and always come out the same.
import { clamp, progress, resolveEase, type Bezier, type EaseSpec } from '../core/ease.ts';
import { track } from '../core/track.ts';
import { resolveFilm } from '../film/resolve.ts';
import { applyTune } from '../film/tune.ts';
import type { Film, Issue, ResolvedLayer, ResolvedMove, ResolvedScene, Timeline, Tracks, Tune } from '../film/types.ts';
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

interface LiveLayer { spec: ResolvedLayer; el: HTMLElement; instance: Instance; tracks: Sampler; ease: { enter?: (x: number) => number; exit?: (x: number) => number } }
interface LiveScene { spec: ResolvedScene; el: HTMLElement; cam: HTMLElement; layers: LiveLayer[]; tracks: Sampler; handover: boolean }
type Sampler = Partial<Record<keyof Tracks, (t: number) => number>>;

const SURFACE = new Set(['base', 'surface', 'sunken', 'accent', 'inverse']);
const ANCHOR: Record<string, string> = {
  center: '-50% -50%', 'top-left': '0 0', top: '-50% 0', 'top-right': '-100% 0', left: '0 -50%', right: '-100% -50%',
  'bottom-left': '0 -100%', bottom: '-50% -100%', 'bottom-right': '-100% -100%',
};
const FLEX: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' };

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

interface Pose { x: number; y: number; scale: number; rotate: number; opacity: number; blur: number }

function applyMove(p: Pose, m: ResolvedMove, k: number, leaving: boolean) {
  // `gone` is how far from rest: 1 before an entrance starts and after an exit ends.
  const gone = leaving ? k : 1 - k;
  const amount = m.amount ?? 0;
  const dir = leaving ? -1 : 1;
  p.opacity *= 1 - gone;
  if (m.move === 'rise') p.y += dir * gone * amount;
  else if (m.move === 'drop') p.y -= dir * gone * amount;
  else if (m.move === 'slide-left') p.x += dir * gone * amount;
  else if (m.move === 'slide-right') p.x -= dir * gone * amount;
  else if (m.move === 'scale') p.scale *= 1 - gone * amount;
  else if (m.move === 'blur') p.blur += gone * amount;
}

function writePose(el: HTMLElement, p: Pose) {
  const still = p.x === 0 && p.y === 0 && p.scale === 1 && p.rotate === 0;
  el.style.transform = still ? '' : `translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg) scale(${p.scale})`;
  el.style.opacity = p.opacity >= 1 ? '' : String(Math.max(0, p.opacity));
  el.style.filter = p.blur > 0.01 ? `blur(${p.blur}px)` : '';
}

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
    tokens, seed: film.seed ?? 1, size: [W, H], easeOverrides: ui.ease, slots: options.slots ?? {},
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
      }
      for (const [k, v] of Object.entries(st.css ?? {})) le.style.setProperty(k, v);
      cam.appendChild(le);
      const instance = PRIMITIVES[layer.use]!.build(le, layer.props, layer.params, ctx);
      return {
        spec: layer, el: le, instance, tracks: samplers(layer.source.tracks, tokens.ease_move, ui.ease),
        ease: { ...(layer.enter ? { enter: ctx.ease(layer.enter.ease) } : {}), ...(layer.exit ? { exit: ctx.ease(layer.exit.ease) } : {}) },
      };
    });
    return { spec, el, cam, layers, tracks: samplers(s.tracks, tokens.ease_move, ui.ease), handover: false };
  });

  const last = scenes[scenes.length - 1]!;

  function seek(time: number) {
    const t = clamp(time, 0, timeline.duration);
    scenes.forEach((scene, i) => {
      const { spec } = scene;
      const on = t >= spec.start && (t < spec.end || scene === last);
      scene.el.style.visibility = on ? 'visible' : 'hidden';
      if (!on) return;
      const local = t - spec.start;

      const cam: Pose = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, blur: 0 };
      sample(cam, scene.tracks, local);
      writePose(scene.cam, cam);

      for (const layer of scene.layers) {
        const l = layer.spec;
        const lt = local - l.start;
        const gone = lt < 0 || (l.exit !== undefined && local >= l.exit.start + l.exit.duration);
        layer.el.style.visibility = gone ? 'hidden' : 'inherit';
        if (gone) continue;
        layer.instance.seek(lt);
        const pose: Pose = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, blur: 0 };
        if (l.enter && layer.ease.enter) applyMove(pose, l.enter, progress(local, l.enter.start, l.enter.duration, layer.ease.enter), false);
        if (l.exit && layer.ease.exit && local >= l.exit.start) applyMove(pose, l.exit, progress(local, l.exit.start, l.exit.duration, layer.ease.exit), true);
        sample(pose, layer.tracks, lt);
        writePose(layer.el, pose);
      }

      // Hand-over: this scene is the outgoing one while the next has already started.
      const next = scenes[i + 1];
      const out = spec.out;
      if (out && next) {
        const active = t >= next.spec.start && t < spec.end && out.duration > 0;
        const tr = TRANSITIONS[out.use]!;
        if (active) {
          tr.apply(scene.el, next.el, (t - next.spec.start) / out.duration, out.params, ctx);
          scene.handover = true;
        } else if (scene.handover) {
          tr.clear(scene.el);
          tr.clear(next.el);
          scene.handover = false;
        }
      }
    });
    // A scene that is not on screen may still carry a finished hand-over's styles.
    scenes.forEach((scene, i) => {
      const next = scenes[i + 1];
      if (!scene.handover || !next || !scene.spec.out) return;
      if (t >= next.spec.start && t < scene.spec.end) return;
      const tr = TRANSITIONS[scene.spec.out.use]!;
      tr.clear(scene.el);
      tr.clear(next.el);
      scene.handover = false;
    });
  }

  function sample(pose: Pose, s: Sampler, t: number) {
    if (s.x) pose.x += s.x(t);
    if (s.y) pose.y += s.y(t);
    if (s.scale) pose.scale *= s.scale(t);
    if (s.rotate) pose.rotate += s.rotate(t);
    if (s.opacity) pose.opacity *= s.opacity(t);
    if (s.blur) pose.blur += s.blur(t);
  }

  function audit(t: number): LayerBox[] {
    seek(t);
    const frame = stage.getBoundingClientRect();
    const k = frame.width > 0 ? W / frame.width : 1;
    const boxes: LayerBox[] = [];
    for (const scene of scenes) {
      if (scene.el.style.visibility === 'hidden') continue;
      for (const layer of scene.layers) {
        if (layer.el.style.visibility === 'hidden') continue;
        const r = layer.el.getBoundingClientRect();
        const x = (r.left - frame.left) * k, y = (r.top - frame.top) * k, width = r.width * k, height = r.height * k;
        const round = (n: number) => Math.round(n * 10) / 10;
        boxes.push({
          scene: scene.spec.id, layer: layer.spec.id, use: layer.spec.use,
          x: round(x), y: round(y), width: round(width), height: round(height),
          off: { left: round(Math.max(0, -x)), top: round(Math.max(0, -y)), right: round(Math.max(0, x + width - W)), bottom: round(Math.max(0, y + height - H)) },
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
