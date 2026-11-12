// Turns a film into a panel of dials, and dial values back into tuning.
//
// Every dial is generated: from the catalog (each primitive's params, with their
// ranges), from the film (its scenes, layers, copy and moves) and from the
// tokens. Nothing here is written per film, so a film an agent has just
// produced is tunable the moment it opens. Pure: no DOM, no DialKit import.
import { EASE_BEZIER, springSpan, type Bezier, type EaseSpec } from '../core/ease.ts';
import { resolveFilm } from '../film/resolve.ts';
import type { Film, ResolvedLayer, ResolvedMove, ResolvedScene, Timeline } from '../film/types.ts';
import { PRIMITIVES, TRANSITIONS } from '../primitives/index.ts';
import type { ParamSpec } from '../primitives/types.ts';
import type { Tokens } from '../tokens.ts';

// The slice of DialKit's config vocabulary the studio uses.
export type Slider = [number, number, number, number];
export interface EasingDial { type: 'easing'; duration: number; ease: [number, number, number, number] }
export interface SpringDial { type: 'spring'; visualDuration?: number; bounce?: number; stiffness?: number; damping?: number; mass?: number }
export type TransitionDial = EasingDial | SpringDial;
export interface PadDial { type: 'pad'; x: Slider; y: Slider; labels: { x: string; y: string } }
export type Dial = Slider | boolean | TransitionDial | PadDial | { type: 'text'; default: string } | { type: 'color'; default: string } | { type: 'action'; label: string };
export interface Folder { [key: string]: Dial | Folder | boolean }

/** What a dial changes in the film: tune paths and the value for each. */
export type Write = (value: unknown) => Record<string, unknown>;
export interface Panel {
  config: Folder;
  /** By dial path (folder keys joined with a tab), how to write its value into the tune. */
  writes: Map<string, Write>;
  /** Every dial's value as the panel was built. */
  values: Map<string, unknown>;
}

export const SEP = '\t';
const round = (n: number, places = 4) => Number(n.toFixed(places));

/** A slider that always contains its value, even one a person typed outside the library range. */
const slider = (value: number, min: number, max: number, step: number): Slider => [round(value), Math.min(min, round(value)), Math.max(max, round(value)), step];

// ---- eases ------------------------------------------------------------------------

export function toTransitionDial(ease: EaseSpec, duration: number): TransitionDial {
  if (typeof ease === 'object' && !Array.isArray(ease)) {
    const s = (ease as { spring: { duration: number; bounce?: number } }).spring;
    return { type: 'spring', visualDuration: s.duration, bounce: s.bounce ?? 0 };
  }
  const b: Bezier = typeof ease === 'string' ? (EASE_BEZIER[ease] ?? EASE_BEZIER['expo.out']!) : (ease as Bezier);
  return { type: 'easing', duration: round(duration), ease: [b[0], b[1], b[2], b[3]] };
}

/** A dial's transition as the film writes it: a duration in seconds and an ease. */
export function fromTransitionDial(dial: TransitionDial): { duration: number; ease: EaseSpec } {
  if (dial.type === 'easing') return { duration: round(dial.duration), ease: dial.ease.map((n) => round(n, 3)) as unknown as Bezier };
  let duration = dial.visualDuration, bounce = dial.bounce ?? 0;
  if (duration === undefined) {
    // A physical spring: express it as time and bounce, which is what a film stores.
    const k = dial.stiffness ?? 100, c = dial.damping ?? 10, m = dial.mass ?? 1;
    const w0 = Math.sqrt(k / m);
    bounce = Math.min(0.95, Math.max(0, 1 - c / (2 * Math.sqrt(k * m))));
    duration = (2 * Math.PI) / (w0 * 1.2);
  }
  const spring = { duration: round(duration, 3), bounce: round(bounce, 3) };
  return { duration: round(springSpan(spring), 3), ease: { spring } };
}

export const dialValue = (dial: Dial | boolean): unknown => {
  if (Array.isArray(dial)) return dial[0];
  if (typeof dial !== 'object') return dial;
  if (dial.type === 'pad') return { x: dial.x[0], y: dial.y[0] };
  if (dial.type === 'text' || dial.type === 'color') return dial.default;
  if (dial.type === 'action') return undefined;
  return dial;
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// ---- building ---------------------------------------------------------------------

class Builder {
  writes = new Map<string, Write>();
  values = new Map<string, unknown>();
  add(folder: Folder, trail: string[], key: string, dial: Dial, write: Write) {
    folder[key] = dial;
    const path = [...trail, key].join(SEP);
    this.writes.set(path, write);
    this.values.set(path, dialValue(dial));
  }
}

/** A key that does not collide with what is already in the folder. */
const free = (folder: Folder, key: string, suffix: string): string => (key in folder ? `${key} ${suffix}` : key);

function paramDials(b: Builder, folder: Folder, trail: string[], specs: Record<string, ParamSpec>, values: Record<string, unknown>, base: string) {
  const pads = new Map<string, { x?: [string, ParamSpec]; y?: [string, ParamSpec] }>();
  for (const [name, spec] of Object.entries(specs)) {
    if (spec.type === 'boolean') { b.add(folder, trail, name, Boolean(values[name]), (v) => ({ [`${base}.${name}`]: v })); continue; }
    if (spec.type !== 'number' || (spec.max ?? 1) <= (spec.min ?? 0)) continue;
    if (spec.pad) { const p = pads.get(spec.pad.name) ?? {}; p[spec.pad.axis] = [name, spec]; pads.set(spec.pad.name, p); continue; }
    b.add(folder, trail, name, slider(Number(values[name] ?? spec.default), spec.min ?? 0, spec.max ?? 1, spec.step ?? 0.01), (v) => ({ [`${base}.${name}`]: v }));
  }
  for (const [name, { x, y }] of pads) {
    if (!x || !y) continue;
    const axis = ([n, s]: [string, ParamSpec]): Slider => slider(Number(values[n] ?? s.default), s.min ?? 0, s.max ?? 1, s.step ?? 0.01);
    b.add(folder, trail, name, { type: 'pad', x: axis(x), y: axis(y), labels: { x: x[1].label.toLowerCase(), y: y[1].label.toLowerCase() } },
      (v) => { const p = v as { x: number; y: number }; return { [`${base}.${x[0]}`]: round(p.x), [`${base}.${y[0]}`]: round(p.y) }; });
  }
}

function moveDials(b: Builder, folder: Folder, trail: string[], key: 'enter' | 'exit', move: ResolvedMove, base: string) {
  b.add(folder, trail, key, toTransitionDial(move.ease, move.duration), (v) => {
    const t = fromTransitionDial(v as TransitionDial);
    return { [`${base}.${key}.duration`]: t.duration, [`${base}.${key}.ease`]: t.ease };
  });
  if (move.move === 'fade') return;
  const scale = move.move === 'scale';
  b.add(folder, trail, `${key} amount`, slider(move.amount ?? 0, 0, scale ? 0.5 : 300, scale ? 0.01 : 1),
    (v) => ({ [`${base}.${key}.amount`]: v }));
}

function layerFolder(b: Builder, trail: string[], scene: ResolvedScene, layer: ResolvedLayer): Folder {
  const folder: Folder = { _collapsed: true };
  const base = `scenes.${scene.id}.layers.${layer.id}`, prim = PRIMITIVES[layer.use]!;
  for (const [name, spec] of Object.entries(prim.props)) {
    if (spec.type !== 'string' || typeof layer.props[name] !== 'string') continue;
    b.add(folder, trail, name, { type: 'text', default: layer.props[name] as string }, (v) => ({ [`${base}.props.${name}`]: v }));
  }
  if (typeof (layer.source.at ?? 0) === 'number') {
    b.add(folder, trail, 'starts at', slider(layer.start, 0, round(scene.length, 2), 0.01), (v) => ({ [`${base}.at`]: round(v as number) }));
  }
  paramDials(b, folder, trail, prim.params, layer.params, `${base}.params`);
  if (layer.enter) moveDials(b, folder, trail, 'enter', layer.enter, base);
  if (layer.exit) moveDials(b, folder, trail, 'exit', layer.exit, base);
  return folder;
}

function build(film: Film, timeline: Timeline, tokens: Tokens): Panel {
  const b = new Builder();
  const config: Folder = {};

  const look: Folder = {};
  config.look = look;
  b.add(look, ['look'], 'dark', film.theme?.scheme === 'dark', (v) => ({ 'theme.scheme': v ? 'dark' : 'light' }));
  b.add(look, ['look'], 'accent', { type: 'color', default: film.theme?.accent ?? '#2440F0' }, (v) => ({ 'theme.accent': v }));

  const motion: Folder = {};
  config.motion = motion;
  const pair = (key: string, ease: EaseSpec, duration: number, easeToken: string, durationToken: string) =>
    b.add(motion, ['motion'], key, toTransitionDial(ease, duration), (v) => {
      const t = fromTransitionDial(v as TransitionDial);
      return { [`tokens.${easeToken}`]: t.ease, [`tokens.${durationToken}`]: t.duration };
    });
  pair('entrances', tokens.ease_enter, tokens.duration.base, 'ease_enter', 'duration.base');
  pair('exits', tokens.ease_exit, tokens.duration.fast, 'ease_exit', 'duration.fast');
  pair('camera and hand-overs', tokens.ease_move, tokens.duration.slow, 'ease_move', 'duration.slow');
  b.add(motion, ['motion'], 'stagger', slider(tokens.stagger.base, 0.01, 0.3, 0.005), (v) => ({ 'tokens.stagger.base': v }));
  b.add(motion, ['motion'], 'hold after a scene', slider(tokens.hold, 0, 3, 0.05), (v) => ({ 'tokens.hold': v }));

  for (const scene of timeline.scenes) {
    const key = free(config, scene.id, 'scene'), trail = [key], base = `scenes.${scene.id}`;
    const folder: Folder = { _collapsed: true };
    config[key] = folder;
    if (scene.source.length !== undefined) b.add(folder, trail, 'length', slider(scene.length, 0.1, Math.max(10, Math.ceil(scene.length * 2)), 0.01), (v) => ({ [`${base}.length`]: round(v as number) }));
    else b.add(folder, trail, 'hold', slider(typeof scene.source.hold === 'number' ? scene.source.hold : scene.length - Math.max(0, ...scene.layers.map((l) => l.end)), 0, 4, 0.05), (v) => ({ [`${base}.hold`]: v }));
    if (scene.out) {
      const hand: Folder = { _collapsed: true };
      folder['hand-over'] = hand;
      paramDials(b, hand, [...trail, 'hand-over'], TRANSITIONS[scene.out.use]!.params, scene.out.params, `${base}.out.params`);
    }
    for (const layer of scene.layers) {
      const lk = free(folder, layer.id, 'layer');
      folder[lk] = layerFolder(b, [...trail, lk], scene, layer);
    }
  }
  config['reset tuning'] = { type: 'action', label: 'Reset tuning' };
  return { config, writes: b.writes, values: b.values };
}

/** The panel for a film, or undefined while the film has errors. */
export function buildPanel(film: Film): Panel | undefined {
  const res = resolveFilm(film);
  return res.timeline ? build(film, res.timeline, res.tokens) : undefined;
}

/** Reads a dial's value out of DialKit's nested values by its path. */
export function readDial(values: unknown, path: string): unknown {
  let cur = values;
  for (const key of path.split(SEP)) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * The overrides a set of dial values amounts to, measured against the untuned
 * film. A dial sitting where the film put it writes nothing, so the tune file
 * holds only what a person actually changed. Paths no dial manages are kept.
 */
export function overridesFrom(values: unknown, tuned: Panel, untuned: Panel, existing: Record<string, unknown>): Record<string, unknown> {
  const out = { ...existing };
  for (const [path, write] of tuned.writes) {
    const now = readDial(values, path);
    if (now === undefined) continue;
    const base = untuned.values.get(path);
    const next = write(now), rest = base === undefined ? {} : write(base);
    for (const [tunePath, value] of Object.entries(next)) {
      if (same(value, rest[tunePath])) delete out[tunePath];
      else out[tunePath] = value;
    }
  }
  return out;
}
