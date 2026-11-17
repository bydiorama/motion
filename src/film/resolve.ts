// Checks a film and turns its relative times into a timeline. Pure: no DOM, so
// an agent can run it in Node and read exactly where each layer lands before
// anything is drawn.
import { EASE_NAMES, isEaseSpec, type EaseSpec } from '../core/ease.ts';
import { PRIMITIVES, TRANSITIONS } from '../primitives/index.ts';
import { UI_THEME_NAMES } from './types.ts';
import type { Cue, ParamSpec, PureCtx } from '../primitives/types.ts';
import type { Key } from '../core/track.ts';
import { isTokenRef, mergeTokens, readToken, tokenPaths, type Tokens } from '../tokens.ts';
import { beatsToSeconds, framesPerBeat, isBeats, wholeFrameTempos, type Tempo } from './tempo.ts';
import {
  ANCHORS, ANGLED_MOVES, ARTBOARD_FITS, PLACE_UNITS, MOVE_NAMES, SURFACES, TEXT_SIZES, TONES, TRACK_PROPS,
  type ExitMove, type Film, type Issue, type Layer, type Move, type MoveName, type ResolvedLayer,
  type ResolvedMove, type ResolvedScene, type Scene, type TimeRef, type Timeline, type Tracks, type FilmAudio,
} from './types.ts';

export interface Resolution {
  ok: boolean;
  issues: Issue[];
  tokens: Tokens;
  /** Present when there are no errors. */
  timeline?: Timeline;
}

const ID = /^[a-z][a-z0-9-]*$/;
/** What is wrong with an id, in words: the pattern alone does not say which rule broke. */
function idProblem(id: unknown, what: 'scene' | 'layer'): string {
  const name = `Give the ${what} an id: lower-case letters, digits and dashes, starting with a letter.`;
  if (typeof id !== 'string' || id === '') return `${name} It has none.`;
  if (what === 'layer' && id === 'scene') return `"scene" cannot be a layer id: times use "scene.end" for the scene itself.`;
  if (/^[0-9]/.test(id)) return `The ${what} id "${id}" starts with a digit. ${name}`;
  if (/[A-Z]/.test(id)) return `The ${what} id "${id}" has capital letters. ${name}`;
  const bad = [...new Set(id.replace(/[a-z0-9-]/g, ''))].map((c) => (c === ' ' ? 'a space' : `"${c}"`));
  return `The ${what} id "${id}" contains ${bad.join(', ')}. ${name}`;
}
/** A corrected id to offer, when one is easy to make. */
function idHint(id: unknown, what: 'scene' | 'layer', fallback: string): string {
  if (typeof id !== 'string' || id === '' || id === 'scene') return fallback;
  let fixed = id.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (/^[0-9]/.test(fixed)) fixed = `${what}-${fixed}`;
  return fixed && fixed !== id ? `For example "${fixed}".` : fallback;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const FILM_KEYS = ['$schema', 'motion', 'title', 'size', 'fps', 'seed', 'poster', 'loop', 'narrative', 'style', 'tokens', 'tempo', 'audio', 'theme', 'scenes'];
const SCENE_KEYS = ['id', 'length', 'hold', 'background', 'scheme', 'layout', 'artboard', 'layers', 'tracks', 'follow', 'out', 'uses', 'intent'];
/** Primitives whose instance has a tip a camera can follow. */
export const FOLLOWABLE = ['fx/path-draw'];
const LAYER_KEYS = ['id', 'use', 'props', 'params', 'at', 'style', 'place', 'enter', 'exit', 'tracks', 'motionBlur', 'parallax'];
const STYLE_KEYS = ['size', 'color', 'font', 'weight', 'align', 'width', 'css'];

const MOVE_AMOUNT: Record<MoveName, number> = {
  fade: 0, rise: 40, drop: 40, scale: 0.08, blur: 16, 'slide-left': 120, 'slide-right': 120,
  zoom: 0.12, pop: 0.5, focus: 24, 'mask-up': 0, 'mask-down': 0, 'wipe-up': 0, 'wipe-down': 0, 'wipe-left': 0, 'wipe-right': 0, swing: 70, 'slot-up': 48,
  wipe: 0, slide: 120,
};
/** Moves that read best with their own curve when the film does not give one. */
const MOVE_EASE: Partial<Record<MoveName, { enter: EaseSpec; exit: EaseSpec }>> = {
  pop: { enter: { spring: { duration: 0.5, bounce: 0.35 } }, exit: 'back.in' },
  'mask-up': { enter: 'expressive.out', exit: 'expressive.in' },
  'slot-up': { enter: 'cubic.out', exit: 'cubic.in' },
  'mask-down': { enter: 'expressive.out', exit: 'expressive.in' },
  'wipe-up': { enter: 'quart.inOut', exit: 'quart.inOut' },
  'wipe-down': { enter: 'quart.inOut', exit: 'quart.inOut' },
  'wipe-left': { enter: 'quart.inOut', exit: 'quart.inOut' },
  'wipe-right': { enter: 'quart.inOut', exit: 'quart.inOut' },
  wipe: { enter: 'quart.inOut', exit: 'quart.inOut' },
  swing: { enter: { spring: { duration: 0.6, bounce: 0.2 } }, exit: 'cubic.in' },
};

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

/** The closest known name, when one is close enough to be a likely typo. */
export function nearest(name: string, known: readonly string[]): string | undefined {
  let best: string | undefined, bestD = Infinity;
  for (const k of known) {
    const d = distance(name, k);
    if (d < bestD) { best = k; bestD = d; }
  }
  return best !== undefined && bestD <= Math.max(2, Math.floor(name.length / 3)) ? best : undefined;
}

const oneOf = (known: readonly string[]) => known.join(', ');

export function resolveFilm(input: unknown): Resolution {
  const issues: Issue[] = [];
  const err = (path: string, code: string, message: string, hint?: string) =>
    issues.push({ level: 'error', code, path, message, ...(hint ? { hint } : {}) });
  const warn = (path: string, code: string, message: string, hint?: string) =>
    issues.push({ level: 'warning', code, path, message, ...(hint ? { hint } : {}) });
  const done = (tokens: Tokens, timeline?: Timeline): Resolution => {
    const ok = !issues.some((i) => i.level === 'error');
    return { ok, issues, tokens, ...(ok && timeline ? { timeline } : {}) };
  };
  const unknownKeys = (obj: Record<string, unknown>, known: readonly string[], path: string) => {
    for (const k of Object.keys(obj)) {
      if (known.includes(k)) continue;
      const near = nearest(k, known);
      err(path ? `${path}.${k}` : k, 'unknown-key', `"${k}" is not a field here.`,
        near ? `Did you mean "${near}"?` : `Fields: ${oneOf(known.filter((x) => x !== '$schema'))}.`);
    }
  };

  if (!isObject(input)) {
    err('', 'not-a-film', 'A film is a JSON object.');
    return done(mergeTokens());
  }
  const film = input as unknown as Film;
  unknownKeys(input, FILM_KEYS, '');

  if (typeof film.motion !== 'string') err('motion', 'missing', 'State the library version the film is written for.', 'Add "motion": "0.4".');
  const size = film.size;
  const sizeOk = Array.isArray(size) && size.length === 2 && size.every((n) => Number.isInteger(n) && n > 0);
  if (!sizeOk) err('size', 'bad-size', 'size is [width, height] in whole px.', 'For example [1920, 1080] or [1080, 1350].');

  const tokens = mergeTokens(isObject(film.tokens) ? film.tokens : undefined);
  if (film.tokens !== undefined) {
    if (!isObject(film.tokens)) err('tokens', 'bad-tokens', 'tokens is an object of overrides.');
    else {
      const known = tokenPaths(mergeTokens());
      const walk = (v: unknown, path: string) => {
        if (isObject(v) && !('spring' in v)) { for (const [k, c] of Object.entries(v)) walk(c, path ? `${path}.${k}` : k); return; }
        if (!known.includes(path)) {
          const near = nearest(path, known);
          err(`tokens.${path}`, 'unknown-token', `There is no token "${path}".`, near ? `Did you mean "${near}"?` : `Tokens: ${oneOf(known)}.`);
        }
      };
      walk(film.tokens, '');
    }
  }
  if (tokens.transitions !== 'standard' && tokens.transitions !== 'calm') err('tokens.transitions', 'bad-value', 'transitions is "standard" or "calm".', 'Calm swaps every transition\'s defaults for its quiet preset.');
  const fps = film.fps ?? tokens.fps;
  if (!Number.isInteger(fps) || fps <= 0) err('fps', 'bad-fps', 'fps is a whole number above zero.');
  let tempo: Tempo | undefined;
  if (film.tempo !== undefined) {
    const tp = film.tempo as unknown;
    if (!isObject(tp) || !isNum(tp.bpm)) err('tempo', 'bad-tempo', 'tempo is { bpm, bar }: beats per minute, and beats in a bar (4 if left out).', 'For example {"bpm": 120, "bar": 4}.');
    else {
      unknownKeys(tp, ['bpm', 'bar'], 'tempo');
      const bar = tp.bar === undefined ? 4 : tp.bar;
      if (tp.bpm < 40 || tp.bpm > 240) err('tempo.bpm', 'bad-value', 'bpm is 40 to 240.', 'Medium swing is 120–150; a calm film 80–100.');
      else if (!Number.isInteger(bar) || (bar as number) < 2 || (bar as number) > 12) err('tempo.bar', 'bad-value', 'bar is a whole number of beats, 2 to 12.');
      else {
        tempo = { bpm: tp.bpm, bar: bar as number };
        const fpb = Number.isInteger(fps) && fps > 0 ? framesPerBeat(tempo, fps) : 1;
        // A soundtrack sets its own tempo: every time is snapped to the nearest frame
        // (within half a frame of the beat), so only a film free to choose is warned.
        if (Math.abs(fpb - Math.round(fpb)) > 1e-6 && film.audio === undefined) {
          warn('tempo.bpm', 'beat-off-frame', `At ${fps} fps a beat of ${tempo.bpm} bpm is ${fpb.toFixed(2)} frames, so beats fall between frames and drift.`,
            `Tempos with a whole number of frames per beat near it: ${wholeFrameTempos(tempo.bpm, fps).join(', ')} bpm.`);
        }
      }
    }
  }
  let audio: Required<FilmAudio> | undefined;
  if (film.audio !== undefined) {
    const a = film.audio as unknown;
    if (!isObject(a) || typeof a.src !== 'string' || !a.src) err('audio', 'bad-audio', 'audio is { src, from, gain, fade_in, fade_out }: a sound file relative to the film, and where in it the film starts.', 'For example {"src": "music/track.mp3", "from": 51.18}.');
    else {
      unknownKeys(a, ['src', 'from', 'gain', 'fade_in', 'fade_out'], 'audio');
      const n = (k: string, d: number, lo: number, hi: number, why: string) => {
        const v = a[k] === undefined ? d : a[k];
        if (!isNum(v) || v < lo || v > hi) { err(`audio.${k}`, 'bad-value', `${k} is ${why}, ${lo} to ${hi}.`); return d; }
        return v;
      };
      audio = { src: a.src, from: n('from', 0, 0, 36000, 'seconds into the file'), gain: n('gain', 0, -30, 6, 'a level in dB'), fade_in: n('fade_in', 0, 0, 10, 'seconds'), fade_out: n('fade_out', 0, 0, 10, 'seconds') };
    }
  }
  /** Seconds for a beat length such as "2b" or "1bar"; reports a missing tempo. */
  const beats = (v: string, path: string): number | undefined => {
    if (!tempo) { err(path, 'needs-tempo', `"${v}" is in beats, but the film has no tempo.`, 'Add "tempo": {"bpm": 120} to the film, or write seconds.'); return undefined; }
    return beatsToSeconds(v, tempo);
  };
  if (film.theme !== undefined) {
    if (!isObject(film.theme)) err('theme', 'bad-theme', 'theme is { scheme, vars }.');
    else {
      unknownKeys(film.theme as Record<string, unknown>, ['scheme', 'accent', 'onAccent', 'ui', 'vars'], 'theme');
      if (film.theme.ui !== undefined && !(UI_THEME_NAMES as readonly unknown[]).includes(film.theme.ui)) err('theme.ui', 'bad-value', `ui is one of the bydiorama/ui themes: ${UI_THEME_NAMES.join(', ')}.`, 'Use "zero", Diorama\'s own theme, unless the brief names another.');
      for (const k of ['accent', 'onAccent'] as const) if (film.theme[k] !== undefined && typeof film.theme[k] !== 'string') err(`theme.${k}`, 'bad-value', `${k} is a CSS colour.`);
      if (film.theme.scheme !== undefined && film.theme.scheme !== 'light' && film.theme.scheme !== 'dark') err('theme.scheme', 'bad-value', 'scheme is "light" or "dark".');
      for (const k of Object.keys(film.theme.vars ?? {})) {
        if (!k.startsWith('--')) err(`theme.vars.${k}`, 'bad-var', 'Theme variables are CSS custom properties.', `Write "--${k}".`);
      }
    }
  }
  if (!Array.isArray(film.scenes) || film.scenes.length === 0) {
    err('scenes', 'no-scenes', 'A film needs at least one scene.');
    return done(tokens);
  }
  if (!sizeOk || !Number.isInteger(fps) || fps <= 0) return done(tokens);

  const frame = 1 / fps;
  const snap = (s: number) => Math.round(s * fps) / fps;
  const ctx: PureCtx = { tokens, seed: film.seed ?? 1, size: [size[0], size[1]] };

  /** A number, or a `$token` that holds one. */
  const seconds = (v: unknown, path: string, what: string): number | undefined => {
    if (isBeats(v)) return beats(v, path);
    const value = isTokenRef(v) ? readToken(tokens, v) : v;
    if (isTokenRef(v) && value === undefined) {
      const known = tokenPaths(tokens).map((p) => `$${p}`), near = nearest(v, known);
      err(path, 'unknown-token', `There is no token "${v}".`, near ? `Did you mean "${near}"?` : undefined);
      return undefined;
    }
    if (!isNum(value) || value < 0) { err(path, 'bad-time', `${what} is a number of seconds, zero or more, a $token, or beats such as "2b" or "1bar".`); return undefined; }
    return value;
  };
  const checkEase = (v: unknown, path: string): EaseSpec | undefined => {
    const value = isTokenRef(v) ? readToken(tokens, v) : v;
    if (!isEaseSpec(value) || (typeof value === 'string' && !EASE_NAMES.includes(value))) {
      const near = typeof value === 'string' ? nearest(value, EASE_NAMES) : undefined;
      err(path, 'bad-ease', 'An ease is a name, a [x1, y1, x2, y2] bezier, or {"spring": {"duration", "bounce"}}.',
        near ? `Did you mean "${near}"?` : `Names: ${oneOf(EASE_NAMES)}.`);
      return undefined;
    }
    return value;
  };
  /** Checks tracks and returns them with every key time in seconds (beats converted). */
  const checkTracks = (tracks: unknown, path: string): Tracks | undefined => {
    if (tracks === undefined) return undefined;
    if (!isObject(tracks)) { err(path, 'bad-tracks', 'tracks is an object of keyframe lists by property.'); return undefined; }
    const out: Record<string, Key[]> = {};
    for (const [prop, keys] of Object.entries(tracks)) {
      const p = `${path}.${prop}`;
      if (!(TRACK_PROPS as readonly string[]).includes(prop)) {
        const near = nearest(prop, TRACK_PROPS);
        err(p, 'unknown-track', `"${prop}" cannot be animated by a track.`, near ? `Did you mean "${near}"?` : `Properties: ${oneOf(TRACK_PROPS)}.`);
        continue;
      }
      if (!Array.isArray(keys) || keys.length === 0) { err(p, 'bad-track', 'A track is a list of [seconds, value] keys.'); continue; }
      out[prop] = keys.map((key, i) => {
        const at = Array.isArray(key) && isBeats(key[0]) ? beats(key[0], `${p}.${i}`) : Array.isArray(key) ? key[0] : undefined;
        if (!Array.isArray(key) || !isNum(at) || !isNum(key[1])) { err(`${p}.${i}`, 'bad-key', 'A key is [time, value] or [time, value, ease]; time in seconds or beats ("2b").'); return key as Key; }
        if (key[2] !== undefined) checkEase(key[2], `${p}.${i}`);
        return (key.length > 2 ? [at, key[1], key[2]] : [at, key[1]]) as Key;
      });
    }
    return out as Tracks;
  };
  const checkParams = (given: unknown, specs: Record<string, ParamSpec>, path: string, owner: string): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(specs)) {
      const d = spec.default;
      out[name] = isTokenRef(d) ? readToken(tokens, d) : d;
    }
    if (given === undefined) return out;
    if (!isObject(given)) { err(path, 'bad-params', 'params is an object.'); return out; }
    for (const [name, raw] of Object.entries(given)) {
      const p = `${path}.${name}`, spec = specs[name];
      if (!spec) {
        const names = Object.keys(specs), near = nearest(name, names);
        err(p, 'unknown-param', `${owner} has no param "${name}".`,
          near ? `Did you mean "${near}"?` : names.length ? `Params: ${oneOf(names)}.` : `${owner} has no params.`);
        continue;
      }
      if (isBeats(raw) && !(spec.type === 'number' && spec.unit === 's')) { err(p, 'bad-param', `${name} is not a time, so it cannot be in beats.`); continue; }
      const value = isBeats(raw) ? beats(raw, p) : isTokenRef(raw) ? readToken(tokens, raw) : raw;
      if (isBeats(raw) && value === undefined) continue;
      if (isTokenRef(raw) && value === undefined) { err(p, 'unknown-token', `There is no token "${raw}".`); continue; }
      if (spec.type === 'number') {
        if (!isNum(value)) { err(p, 'bad-param', `${name} is a number${spec.unit ? ` (${spec.unit})` : ''}.`); continue; }
        if ((spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)) {
          warn(p, 'out-of-range', `${name} is ${value}; the library's range is ${spec.min}–${spec.max}${spec.unit ? ` ${spec.unit}` : ''}.`,
            'Allowed, but outside what has been seen to look right. Check the frames.');
        }
      } else if (spec.type === 'ease') { if (checkEase(value, p) === undefined) continue; }
      else if (spec.type === 'boolean') { if (typeof value !== 'boolean') { err(p, 'bad-param', `${name} is true or false.`); continue; } }
      else if (spec.type === 'choice' && !(spec.options ?? []).includes(String(value))) {
        err(p, 'bad-param', `${name} is one of: ${oneOf(spec.options ?? [])}.`); continue;
      }
      out[name] = value;
    }
    return out;
  };

  const sceneIds = new Set<string>();
  const scenes: ResolvedScene[] = [];
  // Each scene's length and hand-over before snapping to frames. Scenes are laid end to
  // end in exact time and only their edges are snapped, so a beat that falls between
  // frames (a soundtrack's tempo) does not drift further off with every cut.
  const exact = new Map<string, { length: number; out: number }>();

  film.scenes.forEach((scene: Scene, si) => {
    const sid = isObject(scene) && typeof scene.id === 'string' ? scene.id : String(si);
    const sp = `scenes.${sid}`;
    if (!isObject(scene)) { err(sp, 'bad-scene', 'A scene is an object.'); return; }
    unknownKeys(scene as unknown as Record<string, unknown>, SCENE_KEYS, sp);
    if (typeof scene.id !== 'string' || !ID.test(scene.id)) err(`${sp}.id`, 'bad-id', idProblem(scene.id, 'scene'), idHint(scene.id, 'scene', 'For example "title" or "stat-2".'));
    else if (sceneIds.has(scene.id)) err(`${sp}.id`, 'duplicate-id', `Two scenes are called "${scene.id}".`);
    sceneIds.add(sid);
    if (scene.scheme !== undefined && scene.scheme !== 'light' && scene.scheme !== 'dark') err(`${sp}.scheme`, 'bad-value', 'scheme is "light" or "dark".');
    if (scene.layout !== undefined) {
      if (!isObject(scene.layout)) err(`${sp}.layout`, 'bad-layout', 'layout is { align, justify, gap, padding }.');
      else unknownKeys(scene.layout as Record<string, unknown>, ['align', 'justify', 'gap', 'padding'], `${sp}.layout`);
    }
    if (scene.artboard !== undefined) {
      const ab = scene.artboard, ap = `${sp}.artboard`;
      if (!isObject(ab)) err(ap, 'bad-artboard', 'artboard is { width, height } in the design\'s pixels, with an optional fit and align.');
      else {
        unknownKeys(ab as unknown as Record<string, unknown>, ['width', 'height', 'fit', 'align'], ap);
        for (const k of ['width', 'height'] as const) {
          if (!isNum(ab[k]) || ab[k] < 1 || ab[k] > 20000) err(`${ap}.${k}`, 'bad-value', `${k} is the design's ${k} in its own pixels, 1 to 20000.`);
        }
        if (ab.fit !== undefined && !(ARTBOARD_FITS as readonly string[]).includes(ab.fit)) err(`${ap}.fit`, 'bad-value', `fit is one of: ${oneOf(ARTBOARD_FITS)}.`);
        if (ab.align !== undefined && !(Array.isArray(ab.align) && ab.align.length === 2 && ab.align.every((v) => isNum(v) && v >= 0 && v <= 100))) {
          err(`${ap}.align`, 'bad-value', 'align is [x, y], each 0 to 100: where the artboard sits along each side of the stage.');
        }
      }
    }
    const sceneTracks = checkTracks(scene.tracks, `${sp}.tracks`);
    if (!Array.isArray(scene.layers)) { err(`${sp}.layers`, 'no-layers', 'A scene has a list of layers. It may be empty.'); return; }

    // ---- layers: content and params -------------------------------------------
    interface Draft { layer: Layer; path: string; duration: number; params: Record<string, unknown>; props: Record<string, unknown>; cues?: Cue[]; cycles?: boolean; speed?: number; start?: number }
    const drafts = new Map<string, Draft>();
    scene.layers.forEach((layer: Layer, li) => {
      const lid = isObject(layer) && typeof layer.id === 'string' ? layer.id : String(li);
      const lp = `${sp}.layers.${lid}`;
      if (!isObject(layer)) { err(lp, 'bad-layer', 'A layer is an object.'); return; }
      unknownKeys(layer as unknown as Record<string, unknown>, LAYER_KEYS, lp);
      if (typeof layer.id !== 'string' || !ID.test(layer.id) || layer.id === 'scene') {
        err(`${lp}.id`, 'bad-id', idProblem(layer.id, 'layer'), idHint(layer.id, 'layer', 'For example "headline" or "photo-2".')); return;
      }
      if (drafts.has(layer.id)) { err(`${lp}.id`, 'duplicate-id', `Two layers in scene "${sid}" are called "${layer.id}".`); return; }
      const prim = typeof layer.use === 'string' ? PRIMITIVES[layer.use] : undefined;
      if (!prim) {
        const known = Object.keys(PRIMITIVES), near = typeof layer.use === 'string' ? nearest(layer.use, known) : undefined;
        const isTransition = typeof layer.use === 'string' && layer.use in TRANSITIONS;
        err(`${lp}.use`, 'unknown-primitive', `There is no code for "${String(layer.use)}".`,
          isTransition ? 'That is a transition. Put it on the scene as "out": {"use": ...}.'
            : near ? `Did you mean "${near}"?` : `Drawable: ${oneOf(known)}. Compose anything else from el/* layers with enter, exit and tracks.`);
        return;
      }
      const props: Record<string, unknown> = {};
      const given = layer.props ?? {};
      if (!isObject(given)) err(`${lp}.props`, 'bad-props', 'props is an object.');
      else {
        for (const k of Object.keys(given)) {
          if (k in prim.props) continue;
          const names = Object.keys(prim.props), near = nearest(k, names);
          const isParam = k in prim.params;
          err(`${lp}.props.${k}`, 'unknown-prop', `${prim.slug} has no prop "${k}".`,
            isParam ? `"${k}" is a motion value. Move it to params.` : near ? `Did you mean "${near}"?` : `Props: ${oneOf(names)}.`);
        }
        for (const [name, spec] of Object.entries(prim.props)) {
          const v = given[name];
          if (v === undefined) {
            if (spec.required) err(`${lp}.props.${name}`, 'missing-prop', `${prim.slug} needs "${name}": ${spec.label}.`);
            else props[name] = spec.default;
            continue;
          }
          const okType = spec.type === 'number' ? isNum(v)
            : spec.type === 'string[]' ? Array.isArray(v) && v.every((x) => typeof x === 'string')
              : spec.type === 'number[]' ? Array.isArray(v) && v.every(isNum)
                : typeof v === 'string';
          if (!okType) { err(`${lp}.props.${name}`, 'bad-prop', `"${name}" is ${spec.type === 'string[]' ? 'a list of strings' : spec.type === 'number[]' ? 'a list of numbers' : `a ${spec.type === 'html' ? 'string' : spec.type}`}.`); continue; }
          if ((spec.type === 'string[]' || spec.type === 'number[]') && spec.required && (v as unknown[]).length === 0) warn(`${lp}.props.${name}`, 'empty', `"${name}" is empty, so nothing is drawn.`);
          props[name] = v;
        }
      }
      const params = checkParams(layer.params, prim.params, `${lp}.params`, prim.slug);
      if (layer.style !== undefined) {
        if (!isObject(layer.style)) err(`${lp}.style`, 'bad-style', 'style is an object.');
        else {
          unknownKeys(layer.style as Record<string, unknown>, STYLE_KEYS, `${lp}.style`);
          const s = layer.style;
          if (s.size !== undefined && !(TEXT_SIZES as readonly unknown[]).includes(s.size)) err(`${lp}.style.size`, 'bad-value', `size is one of: ${oneOf(TEXT_SIZES)}.`);
          if (s.color !== undefined && !(TONES as readonly unknown[]).includes(s.color)) err(`${lp}.style.color`, 'bad-value', `color is one of: ${oneOf(TONES)}.`, 'For any other colour use style.css or a theme variable.');
          if (s.width !== undefined && (!isNum(s.width) || s.width <= 0 || s.width > 100)) err(`${lp}.style.width`, 'bad-value', 'width is a percentage of the stage, 1 to 100.');
        }
      }
      if (layer.place !== undefined) {
        const pl = layer.place;
        if (!isObject(pl) || !isNum(pl.x) || !isNum(pl.y)) err(`${lp}.place`, 'bad-place', 'place is { x, y } in percent of the stage (or artboard pixels with unit "px"), with an optional anchor.');
        else {
          unknownKeys(pl as unknown as Record<string, unknown>, ['x', 'y', 'anchor', 'unit'], `${lp}.place`);
          if (pl.anchor !== undefined && !(ANCHORS as readonly string[]).includes(pl.anchor)) err(`${lp}.place.anchor`, 'bad-value', `anchor is one of: ${oneOf(ANCHORS)}.`);
          if (pl.unit !== undefined && !(PLACE_UNITS as readonly string[]).includes(pl.unit)) err(`${lp}.place.unit`, 'bad-value', `unit is "%" (of the stage) or "px" (of the scene's artboard).`);
        }
      }
      const tracks = checkTracks(layer.tracks, `${lp}.tracks`);
      if (layer.motionBlur !== undefined && typeof layer.motionBlur !== 'boolean' && !(isNum(layer.motionBlur) && layer.motionBlur >= 0 && layer.motionBlur <= 1)) {
        err(`${lp}.motionBlur`, 'bad-value', 'motionBlur is true (a half-frame shutter) or the share of a frame the shutter is open, 0 to 1.');
      }
      if (prim.check) {
        try {
          for (const i of prim.check(props, params, ctx)) err(`${lp}.${i.path}`, 'bad-value', i.message, i.hint);
        } catch { /* reported above as a bad prop or param */ }
      }
      let duration = 0;
      try { duration = prim.duration(props, params, ctx); } catch { /* reported above as a bad prop or param */ }
      let cues: Cue[] | undefined;
      try { cues = prim.cues?.(props, params, ctx); } catch { /* as above */ }
      let speed: number | undefined;
      try { speed = prim.speed?.(props, params, ctx); } catch { /* as above */ }
      // The resolved layer carries its tracks in seconds, so the page never sees a beat.
      const source = tracks ? { ...layer, tracks } : layer;
      drafts.set(layer.id, { layer: source, path: lp, duration: Number.isFinite(duration) ? duration : 0, params, props, ...(cues ? { cues } : {}), ...(prim.cycles ? { cycles: true } : {}), ...(speed !== undefined && Number.isFinite(speed) ? { speed } : {}) });
    });

    // ---- moves ----------------------------------------------------------------
    const move = (spec: MoveName | Move | ExitMove | undefined, path: string, exit: boolean): Omit<ResolvedMove, 'start'> | undefined => {
      if (spec === undefined) return undefined;
      const m: Move = typeof spec === 'string' ? { move: spec } : spec;
      if (!isObject(m) || !MOVE_NAMES.includes(m.move)) {
        const near = isObject(m) && typeof m.move === 'string' ? nearest(m.move, MOVE_NAMES) : undefined;
        err(path, 'unknown-move', `A move is one of: ${oneOf(MOVE_NAMES)}.`, near ? `Did you mean "${near}"?` : undefined);
        return undefined;
      }
      unknownKeys(m as unknown as Record<string, unknown>, exit ? ['move', 'duration', 'ease', 'amount', 'angle', 'at'] : ['move', 'duration', 'ease', 'amount', 'angle'], path);
      const angled = ANGLED_MOVES.includes(m.move);
      if (m.angle !== undefined) {
        if (!isNum(m.angle)) err(`${path}.angle`, 'bad-value', 'angle is degrees: 0 rightwards, 90 downwards, 180 leftwards, 270 upwards.');
        else if (!angled) warn(`${path}.angle`, 'unused', `${m.move} has a fixed direction, so angle is ignored.`, `Use "wipe" or "slide" to travel at an angle.`);
      }
      const duration = m.duration === undefined ? (exit ? tokens.duration.fast : tokens.duration.base) : seconds(m.duration, `${path}.duration`, 'duration');
      const own = MOVE_EASE[m.move];
      const ease = m.ease === undefined ? (own ? own[exit ? 'exit' : 'enter'] : exit ? tokens.ease_exit : tokens.ease_enter) : checkEase(m.ease, `${path}.ease`);
      if (m.amount !== undefined && !isNum(m.amount)) err(`${path}.amount`, 'bad-value', 'amount is a number.');
      if (duration === undefined || ease === undefined) return undefined;
      return { move: m.move, duration, ease, amount: isNum(m.amount) ? m.amount : MOVE_AMOUNT[m.move], ...(angled ? { angle: isNum(m.angle) ? m.angle : 0 } : {}) };
    };
    const enters = new Map<string, Omit<ResolvedMove, 'start'>>();
    for (const [id, d] of drafts) {
      const e = move(d.layer.enter, `${d.path}.enter`, false);
      if (e) enters.set(id, e);
    }
    const lengthOf = (id: string) => Math.max(drafts.get(id)!.duration, enters.get(id)?.duration ?? 0);

    // ---- layer starts: relative times, resolved in dependency order ------------
    const REF = /^\s*([a-z][a-z0-9-]*)\.(start|end)\s*(?:([+-])\s*(\d+(?:\.\d+)?\s*(?:b|beats?|bars?)?))?\s*$/;
    const visiting = new Set<string>();
    let sceneLength: number | undefined, exactLength: number | undefined;
    const timeRef = (ref: TimeRef, path: string, self: string | undefined): number | undefined => {
      if (isNum(ref)) {
        if (ref < 0) { err(path, 'bad-time', 'Times are seconds from the scene start, zero or more.'); return undefined; }
        return ref;
      }
      if (isBeats(ref)) return beats(ref, path);
      const m = typeof ref === 'string' ? REF.exec(ref) : null;
      if (!m) {
        err(path, 'bad-time', 'A time is seconds from the scene start, or a reference such as "headline.end + 0.2".',
          'References: "<layer id>.start", "<layer id>.end", "scene.end", each with an optional + or - seconds or beats ("+ 1b"). With a tempo, "4b" alone is a time too.');
        return undefined;
      }
      const [, target, edge, sign, amount] = m;
      const size = amount === undefined ? 0 : isBeats(amount) ? beats(amount, path) : Number(amount);
      if (size === undefined) return undefined;
      const offset = (sign === '-' ? -1 : 1) * size;
      if (target === 'scene') {
        if (edge === 'start') return Math.max(0, offset);
        if (sceneLength === undefined) {
          err(path, 'needs-length', '"scene.end" can only place a layer when the scene has a length.', `Add "length" to scene "${sid}", or refer to a layer instead.`);
          return undefined;
        }
        return Math.max(0, sceneLength + offset);
      }
      if (target === self) { err(path, 'self-reference', 'A layer cannot be timed against itself.'); return undefined; }
      if (!drafts.has(target!)) {
        const ids = [...drafts.keys()].filter((k) => k !== self), near = nearest(target!, ids);
        err(path, 'unknown-layer', `Scene "${sid}" has no layer "${target}".`, near ? `Did you mean "${near}"?` : `Layers here: ${oneOf(ids) || 'none'}.`);
        return undefined;
      }
      const base = startOf(target!);
      if (base === undefined) return undefined;
      return Math.max(0, base + (edge === 'end' ? lengthOf(target!) : 0) + offset);
    };
    const startOf = (id: string): number | undefined => {
      const d = drafts.get(id)!;
      if (d.start !== undefined) return d.start;
      if (visiting.has(id)) {
        err(`${d.path}.at`, 'time-cycle', `Layers ${[...visiting].join(' → ')} → ${id} are timed against each other in a circle.`, 'Give one of them a number.');
        return undefined;
      }
      visiting.add(id);
      const start = d.layer.at === undefined ? 0 : timeRef(d.layer.at, `${d.path}.at`, id);
      visiting.delete(id);
      if (start !== undefined) d.start = snap(start);
      return d.start;
    };
    if (scene.length !== undefined) {
      const len = isBeats(scene.length) ? beats(scene.length, `${sp}.length`) : scene.length;
      if (len === undefined) { /* reported */ } else if (!isNum(len) || len <= 0) err(`${sp}.length`, 'bad-time', 'length is seconds above zero, or beats ("8b", "2bars").');
      else { sceneLength = Math.max(frame, snap(len)); exactLength = Math.max(frame, len); }
    }
    for (const id of drafts.keys()) startOf(id);
    const hold = scene.hold === undefined ? tokens.hold : seconds(scene.hold, `${sp}.hold`, 'hold') ?? tokens.hold;
    if (sceneLength === undefined) {
      const lastEnd = Math.max(0, ...[...drafts.entries()].map(([id, d]) => (d.start ?? 0) + lengthOf(id)));
      sceneLength = Math.max(frame, snap(lastEnd + hold));
    } else if (scene.hold !== undefined) warn(`${sp}.hold`, 'unused', 'hold is ignored when the scene has a length.');
    const length = sceneLength;

    const layers: ResolvedLayer[] = [];
    const cameraMoves = !!scene.follow || (['x', 'y'] as const).some((k) => (scene.tracks?.[k]?.length ?? 0) > 1);
    const cycling: { path: string; id: string; start: number; cues: Cue[] }[] = [];
    for (const [id, d] of drafts) {
      if (d.start === undefined) continue;
      const end = d.start + lengthOf(id);
      if (d.start >= length) {
        const last = Math.max(0, length - frame);
        err(`${d.path}.at`, 'never-seen', d.start - length < frame / 2
          ? `Layer "${id}" starts at ${d.start.toFixed(3)} s, the moment scene "${sid}" ends, so it is never on screen.`
          : `Layer "${id}" starts at ${d.start.toFixed(3)} s, after scene "${sid}" ends at ${length.toFixed(3)} s.`,
        `Times snap to whole frames at ${fps} fps, so the last frame a layer can start on is ${last.toFixed(3)} s. Start it earlier or make the scene longer.`);
        continue;
      }
      // A layer that cycles may end on any rest; whether a change is cut is checked
      // against the hand-over, below, once it is known.
      if (d.cycles && d.cues) cycling.push({ path: d.path, id, start: d.start, cues: d.cues });
      else if (end > length + 1e-6) {
        warn(d.path, 'cut-off', `Layer "${id}" finishes at ${end.toFixed(2)} s, ${(end - length).toFixed(2)} s after scene "${sid}" ends.`,
          scene.length !== undefined ? `Raise the scene length to at least ${end.toFixed(2)}, or start the layer earlier.` : 'Start the layer earlier.');
      }
      const enter = enters.get(id);
      const exitSpec = move(d.layer.exit, `${d.path}.exit`, true);
      let exit: ResolvedMove | undefined;
      if (exitSpec) {
        const at = typeof d.layer.exit === 'object' && d.layer.exit.at !== undefined ? timeRef(d.layer.exit.at, `${d.path}.exit.at`, undefined) : length - exitSpec.duration;
        if (at !== undefined) {
          exit = { ...exitSpec, start: snap(Math.max(0, at)) };
          if (exit.start < d.start) err(`${d.path}.exit.at`, 'exit-before-enter', `Layer "${id}" leaves at ${exit.start.toFixed(2)} s, before it arrives at ${d.start.toFixed(2)} s.`);
          else if (exit.start < end - 1e-6) warn(`${d.path}.exit`, 'exit-early', `Layer "${id}" starts leaving at ${exit.start.toFixed(2)} s while it is still arriving (until ${end.toFixed(2)} s).`);
        }
      }
      let parallax: ResolvedLayer['parallax'];
      if (d.layer.parallax !== undefined) {
        const pp = `${d.path}.parallax`, raw = d.layer.parallax;
        const spec = isNum(raw) ? { depth: raw } : raw;
        if (!isObject(spec) || !isNum(spec.depth) || spec.depth < 0 || spec.depth > 10) {
          err(pp, 'bad-value', 'parallax is a depth from 0 to 10 (1 travels with the scene, above 1 is nearer), or { depth, home }.');
        } else {
          unknownKeys(spec as unknown as Record<string, unknown>, ['depth', 'home'], pp);
          const home = spec.home === undefined ? length : timeRef(spec.home, `${pp}.home`, undefined);
          if (home !== undefined) parallax = { depth: spec.depth, home: Math.min(home, length) };
          if (!cameraMoves) warn(pp, 'unused', `Scene "${sid}"'s camera does not travel, so parallax has nothing to follow.`, 'Give the scene x or y tracks, or a follow.');
          if (scene.follow && isObject(scene.follow) && scene.follow.layer === id) err(pp, 'bad-follow', `The camera follows "${id}", so it cannot also travel against the camera.`);
        }
      }
      layers.push({
        id, use: d.layer.use, start: d.start, duration: d.duration, end, props: d.props, params: d.params, ...(d.cues ? { cues: d.cues } : {}), ...(d.speed !== undefined ? { speed: d.speed } : {}),
        ...(enter ? { enter: { ...enter, start: d.start } } : {}), ...(exit ? { exit } : {}), ...(parallax ? { parallax } : {}), source: d.layer,
      });
    }

    // ---- camera follow -----------------------------------------------------------
    if (scene.follow !== undefined) {
      const fp = `${sp}.follow`, f = scene.follow;
      if (!isObject(f)) err(fp, 'bad-follow', 'follow is { layer, at, lag, blend }.');
      else {
        unknownKeys(f as unknown as Record<string, unknown>, ['layer', 'at', 'lag', 'blend'], fp);
        const target = typeof f.layer === 'string' ? layers.find((l) => l.id === f.layer) : undefined;
        if (!target) {
          const ids = layers.filter((l) => FOLLOWABLE.includes(l.use)).map((l) => l.id), near = typeof f.layer === 'string' ? nearest(f.layer, ids) : undefined;
          err(`${fp}.layer`, 'unknown-layer', `Scene "${sid}" has no layer "${String(f.layer)}" to follow.`, near ? `Did you mean "${near}"?` : ids.length ? `Lines here: ${oneOf(ids)}.` : `Add a line to follow: ${oneOf(FOLLOWABLE)}.`);
        } else if (!FOLLOWABLE.includes(target.use)) {
          err(`${fp}.layer`, 'bad-follow', `${target.use} has no tip to follow.`, `The camera can follow: ${oneOf(FOLLOWABLE)}.`);
        }
        if (f.at !== undefined && !(Array.isArray(f.at) && f.at.length === 2 && f.at.every((v) => isNum(v) && v >= 0 && v <= 100))) {
          err(`${fp}.at`, 'bad-value', 'at is [x, y] in % of the stage, 0 to 100.', 'The middle is [50, 50].');
        }
        for (const k of ['lag', 'blend'] as const) {
          if (f[k] !== undefined && !(isNum(f[k]) && f[k]! >= 0)) err(`${fp}.${k}`, 'bad-time', `${k} is seconds, zero or more.`);
        }
      }
    }

    // ---- hand-over to the next scene ------------------------------------------
    let out: ResolvedScene['out'], exactOut = 0;
    if (scene.out !== undefined) {
      const op = `${sp}.out`;
      const t = isObject(scene.out) && typeof scene.out.use === 'string' ? TRANSITIONS[scene.out.use] : undefined;
      if (!t) {
        const known = Object.keys(TRANSITIONS), use = isObject(scene.out) ? String(scene.out.use) : '';
        const near = nearest(use, known);
        err(`${op}.use`, 'unknown-transition', `There is no code for transition "${use}".`, near ? `Did you mean "${near}"?` : `Transitions: ${oneOf(known)}.`);
      } else {
        unknownKeys(scene.out as unknown as Record<string, unknown>, ['use', 'duration', 'params'], op);
        // A calm film starts every transition from its quiet preset.
        const specs = tokens.transitions === 'calm' && t.calm
          ? Object.fromEntries(Object.entries(t.params).map(([k, spec]) => [k, k in t.calm! ? { ...spec, default: t.calm![k] } : spec]))
          : t.params;
        const params = checkParams(scene.out.params, specs, `${op}.params`, t.slug);
        if (scene.out.duration !== undefined) {
          const d = seconds(scene.out.duration, `${op}.duration`, 'duration');
          if (d !== undefined) params.duration = d;
        }
        const duration = snap(isNum(params.duration) ? params.duration : 0);
        if (si === film.scenes.length - 1) warn(op, 'unused', 'The last scene has nothing to hand over to, so "out" is ignored.');
        else if (duration >= length) err(`${op}.duration`, 'too-long', `The hand-over (${duration.toFixed(2)} s) is not shorter than scene "${sid}" (${length.toFixed(2)} s).`);
        else { out = { use: t.slug, duration, params }; exactOut = isNum(params.duration) ? params.duration : 0; }
      }
    }
    // A cycling layer is last seen at the cut: the middle of the hand-over out, or the scene's end.
    const cutAt = length - (out ? out.duration / 2 : 0);
    for (const c of cycling) {
      const cut = c.cues.find((q) => c.start + q.at < cutAt - 1e-6 && c.start + q.at + q.length > cutAt + 1e-6);
      if (cut) {
        warn(c.path, 'cut-mid-change', `Scene "${sid}" is last seen at ${cutAt.toFixed(2)} s, in the middle of a change of layer "${c.id}" (${(c.start + cut.at).toFixed(2)}–${(c.start + cut.at + cut.length).toFixed(2)} s).`,
          'End the scene on a rest: after the change, or before it begins.');
      }
    }
    exact.set(sid, { length: exactLength ?? length, out: exactOut });
    scenes.push({ id: sid, start: 0, length, end: length, layers, ...(out ? { out } : {}), source: sceneTracks ? { ...scene, tracks: sceneTracks } : scene });
  });

  // ---- scene starts: in order, overlapping by each hand-over ------------------
  let cursor = 0;
  scenes.forEach((s, i) => {
    const prev = scenes[i - 1];
    if (prev?.out) {
      if (prev.out.duration >= s.length) {
        err(`scenes.${prev.id}.out.duration`, 'too-long', `The hand-over (${prev.out.duration.toFixed(2)} s) is not shorter than the next scene "${s.id}" (${s.length.toFixed(2)} s).`);
      }
      cursor -= exact.get(prev.id)?.out ?? prev.out.duration;
    }
    s.start = snap(cursor);
    cursor += exact.get(s.id)?.length ?? s.length;
    s.end = snap(cursor);
    s.length = s.end - s.start;
  });
  linkFootage(scenes, frame, err);
  const duration = snap(cursor);
  if (film.poster !== undefined && (!isNum(film.poster) || film.poster < 0 || film.poster > duration)) {
    err('poster', 'bad-time', `poster is a time inside the film, 0 to ${duration.toFixed(2)} s.`);
  }
  return done(tokens, { duration, fps, frames: Math.round(duration * fps), size: [size[0], size[1]], scenes, ...(tempo ? { tempo } : {}), ...(film.loop ? { loop: true } : {}), ...(audio ? { audio } : {}) });
}

/**
 * Footage that `continues` another video layer opens on the frame after that
 * layer's last one on screen, so a film that ends on a shot and opens on its
 * continuation loops through the footage without a seam.
 */
function linkFootage(scenes: ResolvedScene[], frame: number, err: (path: string, code: string, message: string, hint?: string) => void) {
  for (const s of scenes) {
    for (const l of s.layers) {
      const ref = l.use === 'el/video' && typeof l.props.continues === 'string' ? l.props.continues : '';
      if (!ref) continue;
      const path = `scenes.${s.id}.layers.${l.id}.props.continues`;
      const [sid, lid] = ref.split('.');
      const scene = scenes.find((x) => x.id === sid), target = scene?.layers.find((x) => x.id === lid);
      if (!scene || !target) {
        err(path, 'unknown-layer', `There is no layer "${ref}" to continue.`, 'Name a video layer as "scene.layer".');
        continue;
      }
      if (target.use !== 'el/video') { err(path, 'bad-value', `"${ref}" is ${target.use}, not el/video.`); continue; }
      if (target === l) { err(path, 'self-reference', 'A video layer cannot continue itself.'); continue; }
      if (target.props.src !== l.props.src) err(path, 'bad-value', `"${ref}" plays ${String(target.props.src)}, a different file.`, 'A continuation plays the same footage.');
      // The target's last frame on screen: its exit's end, or the scene's last frame.
      const last = Math.min(scene.length, target.exit ? target.exit.start + target.exit.duration : scene.length) - frame;
      const rate = typeof target.params.rate === 'number' ? target.params.rate : 1;
      const lt = Math.max(0, last - target.start);
      const from = typeof target.props.from === 'number' ? target.props.from : 0, to = typeof target.props.to === 'number' ? target.props.to : 0;
      let at = from + lt * rate;
      if (target.params.loop === true && to > from) at = from + ((lt * rate) % (to - from));
      else if (to > from) at = Math.min(to, at);
      l.props = { ...l.props, from: Number((at + frame * rate).toFixed(6)) };
      if (typeof l.props.to === 'number' && l.props.to !== 0 && l.props.to <= (l.props.from as number)) {
        err(`scenes.${s.id}.layers.${l.id}.props.to`, 'bad-value', `to (${l.props.to} s) comes before the continuation starts (${(l.props.from as number).toFixed(3)} s).`, 'Leave it at 0, or move it later.');
      }
    }
  }
}

/** A compact, readable account of the timeline: what an agent reads back after writing a film. */
export function describeTimeline(t: Timeline): string {
  const s = (n: number) => n.toFixed(2).padStart(6);
  const lines = [`${t.duration.toFixed(2)} s · ${t.frames} frames at ${t.fps} fps · ${t.size[0]}×${t.size[1]}`, ''];
  for (const sc of t.scenes) {
    lines.push(`${s(sc.start)} – ${s(sc.end)}  scene ${sc.id}${sc.out ? `  → ${sc.out.use} ${sc.out.duration.toFixed(2)} s` : ''}`);
    for (const l of sc.layers) {
      const bits = [l.use, l.enter ? `enter ${l.enter.move}` : '', l.exit ? `exit ${l.exit.move} @${(sc.start + l.exit.start).toFixed(2)}` : ''].filter(Boolean);
      lines.push(`  ${s(sc.start + l.start)} – ${s(sc.start + l.end)}  ${l.id.padEnd(14)} ${bits.join(' · ')}`);
    }
  }
  return lines.join('\n');
}
