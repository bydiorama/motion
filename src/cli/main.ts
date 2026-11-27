// The command line. Every command that reports on a film can print JSON
// (--json), so an agent reads results as data and a person reads them as text.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCatalog } from '../catalog.ts';
import { describeTimeline, resolveFilm, type Resolution } from '../film/resolve.ts';
import { applyTune, bake } from '../film/tune.ts';
import { describePace, pace } from '../film/pace.ts';
import { sceneFromDesign, type Design } from '../build/design.ts';
import { analyseBeats, loopWindows, offDownbeat, seams, type BeatAnalysis } from '../film/beats.ts';
import type { Issue, Timeline } from '../film/types.ts';
import { open, type Session } from './browser.ts';
import { capture } from './capture.ts';
import { record } from './record.ts';
import { describe as describeReview, filmCuts, review } from './review.ts';
import { Analyser, findings, REFERENCE_SHORT } from '../review/measure.ts';
import type { LayerBox } from '../dom/mount.ts';
import { bundle, wizardPage, filmName, inlineCss, readFilm, readJson, readTune, ROOT, tunePath, writeJson } from './files.ts';
import { filmSchema } from './schema.ts';
import { readLibrary } from './library.ts';
import { checkAnswers, writeBrief } from '../brief/brief.ts';
import type { Answers } from '../brief/types.ts';
import { serve, shell } from './server.ts';

const HELP = `motion <command> [film.json] [options]

Start
  wizard [--port n] [--out file.html]  Answer a few questions; get a brief to paste into Claude or ChatGPT
  brief <answers.json> [--out file.md]  The same brief from saved answers, for scripts and agents

Write and check
  catalog [--json|--write|--check]  What a film may use: primitives, params, tokens, eases
  make <script.mjs> [--out f.json]  Run a script that returns a film; check it and write the JSON
  validate <film...> [--json]       Check films without a browser
  import <design.json> [--id scene] [--step 0.5b] [--fit cover] [--align 0,50] [--out scene.json]
                                    A scene that builds a layout from its exported parts, on its artboard
  inspect <film> [--json]           The resolved timeline: where every scene and layer lands
  beats <audio|film> [--bars n] [--bar 4] [--json]   A soundtrack's tempo, downbeats and the
                                    stretches that loop; for a film, its tempo, audio.from and seam
  pace <film> [--json]              The rhythm: hand-overs against scenes, lengths of changes and rests,
                                    share in motion, and with a tempo, the beat grid
  notes <film> [--json]             The person's open notes, with where each one points

Look
  preview <film> [--port n]         The studio: scrub, tune, pin notes. Saves <film>.tune.json
  stills <film> [--at 1.2,3] [--scale n]   Frames as PNG plus a contact sheet, in out/<film>/
  check <film> [--json] [--loop]    Draw it and test: repeatable frames, layers on stage, page errors;
                                    --loop (or "loop": true) measures the seam from last frame to first
  review <film|video.mp4> [--json] [--loop] [--video file]
                                    Watch the motion frame by frame: a camera that wiggles, jumps or
                                    stalls, parts floating against the rest, frames that blink, flicker
                                    or shimmer. Run it on every render and on recorded footage

Collect
  capture <url> [--sections] [--selector css] [--out dir] [--width 1440] [--scale 2]
          [--hide sel,sel] [--keep-banners] [--keep-header]
                                    Screenshots of a page, or of each section, for a film to use
  record <url> [--out file.mp4|dir] [--duration 4] [--fps 60] [--size 1080x1920] [--scale 1]
         [--scheme light|dark] [--lead 0] [--crf 12] [--marks sel,sel] [--no-guard]
                                    Footage of a live page on a virtual clock: its timers, frames and
                                    CSS animations step a frame at a time, so the footage is exact.
                                    The guard reports layout moves, re-wraps, CSS zoom and scaled
                                    stages; --marks writes those elements' boxes per frame to
                                    <out>.marks.json, for a footage plane to aim at

Deliver
  render <film> [--out file.mp4] [--scale 2] [--crf 15] [--fast]   MP4 through ffmpeg, plus a report;
                                    frames go as PNG, or JPEG with --fast for drafts
  build <film> [--out file.html]    One self-contained page that plays the film
  bake <film>                       Write the tuning into the film and empty the tune file

Options for every command that draws
  --css <file>    A stylesheet to load, e.g. a bydiorama/ui theme. Repeat for more.
  --no-tune       Ignore <film>.tune.json
  --browser <path>  A Chromium-based browser to draw with (Chrome, Brave, Edge),
                  when Playwright's own is not installed. Or set MOTION_CHROMIUM.
`;

interface Args { _: string[]; flags: Record<string, string | boolean>; css: string[] }

function parse(argv: string[]): Args {
  const out: Args = { _: [], flags: {}, css: [] };
  const BOOL = new Set(['json', 'write', 'check', 'no-tune', 'help', 'loop', 'sections', 'keep-banners', 'keep-header', 'fast', 'no-guard']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    if (BOOL.has(key)) { out.flags[key] = true; continue; }
    const value = argv[++i];
    if (value === undefined) throw new Error(`--${key} needs a value`);
    if (key === 'css') out.css.push(value); else out.flags[key] = value;
  }
  return out;
}

const print = (data: unknown) => console.log(JSON.stringify(data, null, 2));
const line = (i: Issue) => `${i.level === 'error' ? 'ERROR' : 'warn '} ${i.path || 'film'}: ${i.message}${i.hint ? ` ${i.hint}` : ''}`;

interface Loaded { file: string; res: Resolution; orphans: string[] }

function load(file: string, args: Args): Loaded {
  const film = readFilm(file);
  const { film: tuned, orphans } = args.flags['no-tune'] ? { film, orphans: [] } : applyTune(film, readTune(file));
  const res = resolveFilm(tuned);
  for (const p of orphans) {
    res.issues.push({ level: 'warning', code: 'orphan-override', path: p, message: 'This tuning override points at something the film no longer has.', hint: `Remove it from ${path.basename(tunePath(file))}, or restore the scene or layer id.` });
  }
  return { file, res, orphans };
}

const browserOpt = (args: Args): { browser?: string } => (typeof args.flags.browser === 'string' ? { browser: args.flags.browser } : {});

function need(args: Args): string {
  const file = args._[1];
  if (!file) throw new Error('Name a film file.\n\n' + HELP);
  return file;
}

function timelineOrExit(l: Loaded, json: boolean): Timeline {
  if (l.res.timeline) return l.res.timeline;
  if (json) print({ ok: false, file: l.file, issues: l.res.issues }); else l.res.issues.forEach((i) => console.error(line(i)));
  process.exit(1);
}

/** The moments worth looking at: each layer settled, each scene's middle and end, each hand-over's middle. */
export function keyMoments(t: Timeline): { t: number; label: string }[] {
  const frame = 1 / t.fps, moments = new Map<number, string>();
  const add = (time: number, label: string) => {
    const snapped = Math.min(t.duration - frame, Math.max(0, Math.round(time * t.fps) / t.fps));
    const key = Math.round(snapped * t.fps);
    if (!moments.has(key)) moments.set(key, label);
  };
  for (const s of t.scenes) {
    for (const l of s.layers) add(s.start + Math.min(l.end, s.length - frame), `${s.id} › ${l.id} settled`);
    add(s.start + s.length / 2, `${s.id} middle`);
    add(s.end - (s.out ? s.out.duration / 2 : frame), s.out ? `${s.id} → ${s.out.use}` : `${s.id} end`);
  }
  return [...moments.entries()].sort((a, b) => a[0] - b[0]).map(([k, label]) => ({ t: k / t.fps, label }));
}

// ---- commands -------------------------------------------------------------------

function catalog(args: Args) {
  const data = buildCatalog();
  const files: [string, unknown][] = [
    [path.join(ROOT, 'catalog.json'), data],
    [path.join(ROOT, 'library.json'), readLibrary()],
    [path.join(ROOT, 'schema/film.schema.json'), filmSchema(data)],
  ];
  if (args.flags.write) {
    for (const [f, d] of files) writeJson(f, d);
    console.log('catalog.json, library.json and schema/film.schema.json written');
  } else if (args.flags.check) {
    const stale = files.filter(([f, d]) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== `${JSON.stringify(d, null, 2)}\n`).map(([f]) => path.relative(ROOT, f));
    if (stale.length) { console.error(`Out of date: ${stale.join(', ')}. Run: pnpm catalog`); process.exit(1); }
    console.log('catalog is up to date');
  } else if (args.flags.json) print(data);
  else {
    const params = (p: Record<string, { default: unknown; min?: number; max?: number; unit?: string }>) =>
      Object.entries(p).map(([k, s]) => `${k}=${String(s.default)}${s.min !== undefined ? ` (${s.min}–${s.max}${s.unit ? ` ${s.unit}` : ''})` : ''}`).join(', ');
    console.log(`motion ${data.motion}\n\nPrimitives`);
    for (const p of data.primitives) {
      console.log(`  ${p.slug.padEnd(22)} ${p.summary}`);
      console.log(`    props:  ${Object.entries(p.props).map(([k, s]) => `${k}${s.required ? '*' : ''}: ${s.type}`).join(', ') || 'none'}`);
      if (Object.keys(p.params).length) console.log(`    params: ${params(p.params)}`);
    }
    console.log('\nTransitions');
    for (const p of data.transitions) console.log(`  ${p.slug.padEnd(26)} ${p.summary}\n    params: ${params(p.params)}`);
    console.log(`\nMoves   ${data.moves.join(', ')}\nTracks  ${data.tracks.join(', ')}\nEases   ${data.eases.join(', ')}\nSizes   ${data.sizes.join(', ')}\nColors  ${data.colors.join(', ')}\n\nFull detail: motion catalog --json`);
  }
}

/** Where `make` writes: beside the script, as <name>.film.json. */
export const madePath = (script: string): string => script.replace(/(\.film)?\.(m?js|m?ts)$/, '') + '.film.json';

/**
 * `@bydiorama/motion` and `@bydiorama/motion/build`, for a script outside this repository
 * (from the Claude plugin, for example), resolve to this copy of the library.
 */
const moduleExtension = path.extname(import.meta.filename);
export const LIBRARY_ENTRIES: Record<string, string> = {
  '@bydiorama/motion': path.resolve(import.meta.dirname, `../index${moduleExtension}`),
  '@bydiorama/motion/build': path.resolve(import.meta.dirname, `../build/index${moduleExtension}`),
};
let libraryResolved = false;
function resolveLibraryImports() {
  if (libraryResolved) return;
  libraryResolved = true;
  registerHooks({
    resolve: (specifier, context, next) => specifier in LIBRARY_ENTRIES
      ? { url: pathToFileURL(LIBRARY_ENTRIES[specifier]!).href, shortCircuit: true }
      : next(specifier, context),
  });
}

async function make(args: Args) {
  const script = need(args), json = !!args.flags.json;
  resolveLibraryImports();
  const mod = await import(pathToFileURL(path.resolve(script)).href) as { default?: unknown };
  let value = mod.default;
  if (typeof value === 'function') value = await (value as () => unknown)();
  if (value === undefined) throw new Error(`${script} has no default export. End it with: export default film({ ... })`);
  const out = path.resolve(typeof args.flags.out === 'string' ? args.flags.out : madePath(script));
  const res = resolveFilm(value);
  if (json) print({ ok: res.ok, file: out, written: res.ok, issues: res.issues, ...(res.timeline ? { duration: res.timeline.duration } : {}) });
  else res.issues.forEach((i) => console.log(line(i)));
  if (!res.ok) {
    if (!json) console.error(`Nothing written: the film has ${res.issues.filter((i) => i.level === 'error').length} error(s).`);
    process.exit(1);
  }
  writeJson(out, value);
  if (!json) console.log(`${path.relative(process.cwd(), out)} written: ${res.timeline!.duration.toFixed(2)} s, ${res.issues.length} warning(s).`);
}

async function captureCmd(args: Args) {
  const url = args._[1];
  if (!url) throw new Error('Name a page to capture: motion capture https://example.com --sections');
  const href = /^[a-z]+:\/\//i.test(url) ? url : fs.existsSync(url) ? pathToFileURL(path.resolve(url)).href : `https://${url}`;
  const host = new URL(href).hostname || filmName(url).replace(/\.html?$/, '') || 'page';
  const num = (k: string, d: number) => { const v = Number(args.flags[k] ?? d); if (!(v > 0)) throw new Error(`--${k} takes a number above zero.`); return v; };
  const shots = await capture({
    url: href, out: path.resolve(typeof args.flags.out === 'string' ? args.flags.out : path.join('out', 'capture', host)),
    sections: !!args.flags.sections, ...(typeof args.flags.selector === 'string' ? { selector: args.flags.selector } : {}),
    width: num('width', 1440), scale: num('scale', 2),
    hide: typeof args.flags.hide === 'string' ? args.flags.hide.split(',').map((x) => x.trim()).filter(Boolean) : [],
    keepBanners: !!args.flags['keep-banners'], keepHeader: !!args.flags['keep-header'], ...browserOpt(args),
  });
  const dir = path.dirname(shots[0]!.file);
  writeJson(path.join(dir, 'capture.json'), { url: href, width: num('width', 1440), scale: num('scale', 2), shots: shots.map((x) => ({ ...x, file: path.basename(x.file) })) });
  if (args.flags.json) return print({ url: href, dir, shots });
  console.log(`${shots.length} screenshot(s) at ${num('scale', 2)}× in ${path.relative(process.cwd(), dir) || '.'}/`);
  for (const x of shots) console.log(`  ${path.basename(x.file).padEnd(32)} ${x.width}×${x.height} px at y ${x.y}`);
}

async function recordCmd(args: Args) {
  const url = args._[1];
  if (!url) throw new Error('Name a page to record: motion record http://localhost:5173/ --duration 4 --out shot.mp4');
  const href = /^[a-z]+:\/\//i.test(url) ? url : fs.existsSync(url) ? pathToFileURL(path.resolve(url)).href : `https://${url}`;
  const num = (k: string, d: number, min = 0) => { const v = Number(args.flags[k] ?? d); if (!(v >= min) || !Number.isFinite(v)) throw new Error(`--${k} takes a number of at least ${min}.`); return v; };
  const size = String(args.flags.size ?? '1080x1920').split('x').map(Number);
  if (size.length !== 2 || !size.every((n) => n > 0)) throw new Error('--size is width x height in CSS px, e.g. 1080x1920.');
  const scheme = args.flags.scheme ?? 'light';
  if (scheme !== 'light' && scheme !== 'dark') throw new Error('--scheme is light or dark.');
  const out = path.resolve(typeof args.flags.out === 'string' ? args.flags.out : path.join('out', 'record', 'footage.mp4'));
  const json = !!args.flags.json;
  const res = await record({
    url: href, out, duration: num('duration', 4, 1 / 120), fps: num('fps', 60, 1), size: [size[0]!, size[1]!], scale: num('scale', 1, 0.25),
    scheme, lead: num('lead', 0), crf: num('crf', 12), ...browserOpt(args), guard: !args.flags['no-guard'],
    ...(typeof args.flags.marks === 'string' ? { marks: args.flags.marks.split(',').map((m) => m.trim()).filter(Boolean) } : {}),
    ...(json ? {} : { onProgress: (d: number, n: number) => { if (d === n || d % 30 === 0) process.stderr.write(`\r  frame ${d}/${n}`); if (d === n) process.stderr.write('\n'); } }),
  });
  if (json) return print(res);
  console.log(`${res.frames} frame(s) at ${res.size[0]}×${res.size[1]} → ${path.relative(process.cwd(), res.out) || res.out}`);
  for (const e of res.errors) console.log(`warn page: ${e}`);
  for (const g of res.guard) console.log(`warn ${g}`);
  if (res.marks) console.log(`Marks: ${path.relative(process.cwd(), res.marks) || res.marks}`);
  if (!res.guard.length) console.log('Guard: the page moved by transforms only, with no re-wraps or CSS zoom.');
}

function validate(args: Args) {
  const files = args._.slice(1);
  if (!files.length) throw new Error('Name one or more film files.');
  const results = files.map((f) => load(f, args));
  // The rhythm checks are warnings: a film that stumbles still plays.
  for (const r of results) if (r.res.timeline) r.res.issues.push(...pace(r.res.timeline).issues);
  if (args.flags.json) print(results.map((r) => ({ file: r.file, ok: r.res.ok, issues: r.res.issues })));
  else for (const r of results) {
    r.res.issues.forEach((i) => console.log(line(i)));
    const e = r.res.issues.filter((i) => i.level === 'error').length;
    console.log(`${r.file}: ${e ? `${e} error(s)` : 'ok'}, ${r.res.issues.length - e} warning(s)${r.res.timeline ? `, ${r.res.timeline.duration.toFixed(2)} s` : ''}`);
  }
  if (results.some((r) => !r.res.ok)) process.exit(1);
}

function inspect(args: Args) {
  const l = load(need(args), args), json = !!args.flags.json;
  const t = timelineOrExit(l, json);
  if (json) {
    print({
      ok: true, file: l.file, duration: t.duration, fps: t.fps, frames: t.frames, size: t.size, issues: l.res.issues,
      scenes: t.scenes.map((s) => ({
        id: s.id, start: s.start, end: s.end, length: s.length, ...(s.out ? { out: s.out } : {}),
        layers: s.layers.map((x) => ({ id: x.id, use: x.use, start: s.start + x.start, end: s.start + x.end, params: x.params, ...(x.enter ? { enter: x.enter } : {}), ...(x.exit ? { exit: x.exit } : {}) })),
      })),
    });
  } else {
    console.log(describeTimeline(t));
    if (l.res.issues.length) { console.log(''); l.res.issues.forEach((i) => console.log(line(i))); }
  }
}

/** Decodes an audio file to mono samples with ffmpeg. */
async function decode(file: string, rate: number): Promise<Float32Array> {
  const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 'f32le', 'pipe:1']);
  const chunks: Buffer[] = [];
  let err = '';
  ff.stdout.on('data', (c: Buffer) => chunks.push(c));
  ff.stderr.on('data', (c: Buffer) => { err += c; });
  const [code] = await once(ff, 'close');
  if (code !== 0) throw new Error(`ffmpeg could not read ${file}: ${err.trim()}`);
  const buf = Buffer.concat(chunks);
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 4)));
}

async function beatsCmd(args: Args) {
  const target = need(args), json = !!args.flags.json, RATE = 22050;
  const isFilm = target.endsWith('.json');
  const film = isFilm ? readFilm(target) : undefined;
  if (film && !film.audio) throw new Error(`${target} has no audio. Name an audio file, or give the film a soundtrack.`);
  const sound = film ? path.resolve(path.dirname(path.resolve(target)), film.audio!.src) : target;
  if (!fs.existsSync(sound)) throw new Error(`${sound} not found.`);
  const bar = Number(args.flags.bar ?? film?.tempo?.bar ?? 4);
  const samples = await decode(sound, RATE);
  const a: BeatAnalysis = analyseBeats(samples, RATE, { bar });
  const barLen = a.beat * a.bar;
  // The film, measured against its music.
  let filmReport: Record<string, unknown> | undefined;
  let bars = args.flags.bars !== undefined ? Number(args.flags.bars) : undefined;
  if (film) {
    const t = timelineOrExit(load(target, args), json);
    const from = film.audio!.from ?? 0, off = offDownbeat(a, from);
    const beatOff = Math.round(((from - a.downbeat) / a.beat) % a.bar + a.bar) % a.bar;
    const filmBars = t.duration / barLen;
    bars ??= Math.round(filmBars);
    const seam = t.loop ? seams(samples, RATE, a)(from, from + t.duration) : undefined;
    filmReport = {
      tempo: film.tempo?.bpm, measured: a.bpm, tempoOff: film.tempo ? Math.round((film.tempo.bpm - a.bpm) * 100) / 100 : undefined,
      from, offBeat: Math.round((((from - a.downbeat) % a.beat) + a.beat * 1.5) % a.beat * 1000 - a.beat * 500) / 1000, barBeat: beatOff + 1,
      nearestDownbeat: Math.round((from - off) * 1000) / 1000, bars: Math.round(filmBars * 100) / 100, ...(seam !== undefined ? { seam } : {}),
    };
  }
  const loops = bars ? loopWindows(samples, RATE, a, bars) : [];
  if (json) return print({ file: sound, ...a, downbeats: undefined, loops, ...(filmReport ? { film: filmReport } : {}) });
  console.log(`${path.basename(sound)}: ${a.bpm} bpm (a beat ${a.beat.toFixed(4)} s, a bar of ${a.bar} ${barLen.toFixed(3)} s), confidence ${a.confidence.toFixed(2)}${a.confidence < 0.3 ? ': check by ear' : ''}`);
  console.log(`First downbeat at ${a.downbeat.toFixed(3)} s, then every ${barLen.toFixed(3)} s.`);
  if (filmReport) {
    const f = filmReport as { tempo?: number; tempoOff?: number; from: number; offBeat: number; barBeat: number; nearestDownbeat: number; bars: number; seam?: number };
    console.log(`\nThe film`);
    console.log(f.tempo === undefined ? `  No tempo: set "tempo": { "bpm": ${a.bpm} }.` : Math.abs(f.tempoOff!) <= 0.02 ? `  tempo ${f.tempo} matches the music.` : `  tempo ${f.tempo} is ${f.tempoOff! > 0 ? 'above' : 'below'} the music's ${a.bpm} by ${Math.abs(f.tempoOff!)} bpm: cuts drift ${(Math.abs(f.tempoOff!) / a.bpm * 100).toFixed(2)}% a beat. Set it to ${a.bpm}.`);
    const ms = Math.round(f.offBeat * 1000);
    console.log(`  audio.from ${f.from} is ${Math.abs(ms) <= 5 ? 'on a beat' : `${Math.abs(ms)} ms ${ms > 0 ? 'after' : 'before'} a beat`}, beat ${f.barBeat} of the bar as measured${f.barBeat === 1 ? '' : ` (the nearest downbeat is ${f.nearestDownbeat} s)`}.${Math.abs(ms) > 5 ? ` To put the film's start on the beat: ${Math.round((f.from - f.offBeat) * 1000) / 1000}.` : ''}`);
    console.log(`  The film runs ${f.bars} bars of the music.${Math.abs(f.bars - Math.round(f.bars)) > 0.02 ? ' A loop that is not whole bars will not loop in the music.' : ''}`);
    if (f.seam !== undefined) console.log(`  Across its loop the music matches ${f.seam.toFixed(2)} (1 is the same either side of the seam; the best windows below).`);
  }
  if (loops.length) {
    console.log(`\nThe ${bars} bars that loop best (from: set as audio.from)`);
    for (const w of loops) console.log(`  from ${w.from.toFixed(3)} s to ${w.to.toFixed(3)} s   match ${w.match.toFixed(2)}`);
  }
  console.log(`\nThe downbeat is the beat where the harmony turns and the low end hits; when it is ambiguous it may be read a beat or two out. Trust the tempo; check the bar by ear.`);
}

function importCmd(args: Args) {
  const file = need(args);
  const design = readJson<Design>(file);
  if (!design || !(design.width > 0) || !(design.height > 0) || !Array.isArray(design.layers)) {
    throw new Error(`${file} is not a design: it needs width, height and layers ([{ name, x, y, width, height, src | fill }], bottom to top).`);
  }
  const id = typeof args.flags.id === 'string' ? args.flags.id : path.basename(file).replace(/\.json$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design';
  const stepFlag = args.flags.step, step = typeof stepFlag === 'string' ? (/^\d+(\.\d+)?$/.test(stepFlag) ? Number(stepFlag) : stepFlag) : undefined;
  const fit = typeof args.flags.fit === 'string' ? args.flags.fit as 'cover' : undefined;
  const alignFlag = typeof args.flags.align === 'string' ? args.flags.align.split(',').map(Number) : undefined;
  if (alignFlag && (alignFlag.length !== 2 || alignFlag.some((v) => !(v >= 0 && v <= 100)))) throw new Error('--align is x,y in % of the stage, e.g. 0,50.');
  const scene = sceneFromDesign(id, design, { ...(step !== undefined ? { step } : {}), ...(fit ? { fit } : {}), ...(alignFlag ? { align: alignFlag as [number, number] } : {}) });
  if (typeof args.flags.out === 'string') { writeJson(args.flags.out, scene); console.log(`${args.flags.out} written: scene "${id}", ${scene.layers.length} layers on a ${design.width} × ${design.height} artboard. Add it to a film's scenes.`); }
  else print(scene);
}

function paceCmd(args: Args) {
  const l = load(need(args), args), json = !!args.flags.json;
  const t = timelineOrExit(l, json);
  const p = pace(t);
  if (json) return print({ ok: true, file: l.file, ...p, issues: [...l.res.issues, ...p.issues] });
  console.log(describePace(t, p));
  const all = [...l.res.issues.filter((i) => i.level === 'error'), ...p.issues];
  console.log(all.length ? '' : '\nThe rhythm checks pass.');
  all.forEach((i) => console.log(line(i)));
}

function notes(args: Args) {
  const file = need(args), tune = readTune(file);
  const l = load(file, args);
  const list = (tune.notes ?? []).map((n) => {
    const scene = l.res.timeline?.scenes.findLast((s) => n.t >= s.start && n.t < s.end);
    const onScreen = scene?.layers.filter((x) => n.t >= scene.start + x.start).map((x) => x.id) ?? [];
    return { ...n, at: scene ? { scene: scene.id, sceneTime: Number((n.t - scene.start).toFixed(3)), layersOnScreen: onScreen } : null };
  });
  if (args.flags.json) return print({ file: tunePath(file), overrides: tune.set ?? {}, notes: list });
  const open_ = list.filter((n) => n.status === 'open');
  console.log(`${open_.length} open note(s), ${Object.keys(tune.set ?? {}).length} override(s) in ${tunePath(file)}`);
  for (const n of open_) console.log(`  ${n.t.toFixed(2)} s  ${n.at ? `${n.at.scene}${n.layer ? ` › ${n.layer}` : ''}` : '?'}  ${n.text}`);
  for (const [p, v] of Object.entries(tune.set ?? {})) console.log(`  set ${p} = ${JSON.stringify(v)}`);
}

async function preview(args: Args) {
  const file = need(args);
  const p = await serve({ film: file, css: args.css, watch: true, ...(args.flags.port ? { port: Number(args.flags.port) } : {}) });
  console.log(`Studio for ${file}: ${p.url}\nDials and notes are saved to ${tunePath(file)}. The page follows edits to the film file. Ctrl+C stops it.`);
}

async function stills(args: Args) {
  const file = need(args), l = load(file, args), t = timelineOrExit(l, false);
  const at = typeof args.flags.at === 'string' ? args.flags.at.split(',').map(Number).map((x) => ({ t: x, label: '' })) : keyMoments(t);
  if (at.some((m) => !Number.isFinite(m.t) || m.t < 0 || m.t > t.duration)) throw new Error(`--at takes times in seconds between 0 and ${t.duration.toFixed(2)}, separated by commas.`);
  const dir = path.join(path.dirname(path.resolve(file)), 'out', filmName(file), 'stills');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const s = await open(file, { css: args.css, size: t.size, scale: Number(args.flags.scale ?? 1), timeline: t, ...browserOpt(args), ...(args.flags['no-tune'] ? { noTune: true } : {}) });
  try {
    const shots: { t: number; label: string; file: string; data: string }[] = [];
    for (const m of at) {
      await s.seek(m.t);
      const png = await s.page.screenshot({ type: 'png' });
      const name = path.join(dir, `t${m.t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(name, png);
      // The sheet uses small JPEGs so it stays a reasonable size.
      shots.push({ t: m.t, label: m.label, file: name, data: (await s.page.screenshot({ type: 'jpeg', quality: 80 })).toString('base64') });
    }
    const cols = Math.min(4, shots.length), cell = Math.round(1600 / cols), sheet = path.join(dir, '..', 'sheet.png');
    const page = await s.page.context().newPage();
    await page.setViewportSize({ width: cols * cell + 24, height: 200 });
    await page.setContent(`<body style="margin:12px;background:#15171b;font:12px ui-monospace,Menlo,monospace;color:#cfd3da"><div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px">${
      shots.map((x) => `<figure style="margin:0"><img src="data:image/jpeg;base64,${x.data}" style="display:block;width:100%"><figcaption style="padding-top:4px">${x.t.toFixed(2)} s${x.label ? ` · ${x.label.replace(/[<&]/g, '')}` : ''}</figcaption></figure>`).join('')
    }</div></body>`);
    await page.screenshot({ path: sheet, fullPage: true });
    await page.close();
    if (args.flags.json) print({ sheet, stills: shots.map(({ t: time, label, file: f }) => ({ t: time, label, file: f })), errors: s.errors });
    else console.log(`${shots.length} stills in ${path.relative(process.cwd(), dir)}/\nContact sheet: ${path.relative(process.cwd(), sheet)}${s.errors.length ? `\nPage errors:\n  ${s.errors.join('\n  ')}` : ''}`);
  } finally { await s.close(); }
}

/** Two draws of one frame count as the same when no pixel is more than this many levels (of 255) apart … */
const REPEAT_LEVELS = 2;
/** … and no more than this share of the pixels differ at all. */
const REPEAT_SHARE = 0.001;
/** Above this difference in the mean of any 16 px block (levels of 255), whole areas differ: that is state, not rasterising. */
const REPEAT_AREA = 24;

async function check(args: Args) {
  const file = need(args), json = !!args.flags.json, l = load(file, args), t = timelineOrExit(l, json);
  const issues: (Issue & { t?: number })[] = [...l.res.issues];
  let loop: Seam | undefined;
  const s = await open(file, { css: args.css, size: t.size, timeline: t, ...browserOpt(args), ...(args.flags['no-tune'] ? { noTune: true } : {}) });
  try {
    // 1. A frame must depend on its time alone: draw the same moments in two orders and compare.
    const times = Array.from({ length: 6 }, (_, k) => Math.round((t.duration * k / 5) * t.fps) / t.fps);
    // Two things are compared. The page's state: every element's box, opacity, visibility, filter and
    // transform, which must match exactly. And the pixels, with room: a browser does not always rasterise
    // the same state the same way (a card that has just become its own layer can land a pixel aside, a blur
    // a level off), which no one can see and no primitive caused. So pixels only fail the film when whole
    // areas differ, as they do when a canvas or a picture holds state the page's boxes do not show.
    const state = () => s.page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.m-scene, .m-cam, .m-layer, .m-layer *')].map((e) => {
      // What is not shown may keep whatever it was last drawn with: only its being hidden is state.
      if (!e.checkVisibility({ visibilityProperty: true })) return 'hidden';
      const r = e.getBoundingClientRect(), c = getComputedStyle(e);
      return [r.x.toFixed(2), r.y.toFixed(2), r.width.toFixed(2), r.height.toFixed(2), c.opacity, c.visibility, c.display, c.filter, c.clipPath, e.style.transform, e.getAttribute('stroke-dashoffset') ?? ''].join('|');
    }).join('\n'));
    const shot = async (time: number) => { await s.seek(time); return { state: await state(), png: (await s.page.screenshot({ type: 'png' })).toString('base64') }; };
    const probe = await s.page.context().newPage();
    const differ = (a: string, b: string) => a === b ? Promise.resolve({ share: 0, max: 0, area: 0 }) : probe.evaluate(async ([x, y]) => {
      const read = async (data: string) => {
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d')!;
        c.drawImage(bmp, 0, 0);
        return { data: c.getImageData(0, 0, bmp.width, bmp.height).data, w: bmp.width, h: bmp.height };
      };
      const [p, q] = [await read(x!), await read(y!)];
      if (p.data.length !== q.data.length) return { share: 1, max: 255, area: 255 };
      // `area` is the largest difference between the two frames' means over 16 px blocks.
      const B = 16, bw = Math.ceil(p.w / B), sums = new Float64Array(bw * Math.ceil(p.h / B)), counts = new Uint32Array(sums.length);
      let count = 0, max = 0;
      for (let i = 0, n = 0; i < p.data.length; i += 4, n++) {
        const d = Math.max(Math.abs(p.data[i]! - q.data[i]!), Math.abs(p.data[i + 1]! - q.data[i + 1]!), Math.abs(p.data[i + 2]! - q.data[i + 2]!));
        if (d > 0) { count++; if (d > max) max = d; }
        const k = Math.floor(Math.floor(n / p.w) / B) * bw + Math.floor((n % p.w) / B);
        sums[k]! += (p.data[i]! + p.data[i + 1]! + p.data[i + 2]!) - (q.data[i]! + q.data[i + 1]! + q.data[i + 2]!);
        counts[k]!++;
      }
      let area = 0;
      for (let k = 0; k < sums.length; k++) if (counts[k]) area = Math.max(area, Math.abs(sums[k]!) / (3 * counts[k]!));
      return { share: count / (p.data.length / 4), max, area };
    }, [a, b]);
    const forward = new Map<number, { state: string; png: string }>();
    for (const time of times) forward.set(time, await shot(time));
    for (const time of [...times].reverse()) {
      const now = await shot(time), was = forward.get(time)!;
      const d = await differ(now.png, was.png);
      const how = `${(d.share * 100).toFixed(2)}% of its pixels, by up to ${d.max} of 255 levels`;
      if (now.state !== was.state || d.area > REPEAT_AREA) issues.push({ level: 'error', code: 'not-repeatable', path: 'film', t: time, message: `The frame at ${time.toFixed(2)} s differs depending on what was drawn before it${now.state !== was.state ? ': elements sit or look different' : ''} (${how}).`, hint: 'A primitive keeps state between seeks, or uses a clock or unseeded randomness.' });
      else if (d.max > REPEAT_LEVELS || d.share > REPEAT_SHARE) issues.push({ level: 'warning', code: 'raster-differs', path: 'film', t: time, message: `The frame at ${time.toFixed(2)} s is rasterised a little differently depending on what was drawn before it (${how}); every element sits and looks the same.`, hint: 'This is the browser, not the film: usually a layer that has just started to fade or scale landing a pixel aside. Look at the two frames if it matters.' });
    }
    await probe.close();
    // 2. Layers must be on the stage and have a size once they have settled. In a
    // scene whose camera moves, a layer is expected to be off stage for part of the
    // time (a canvas the camera travels over), so it is reported only if the camera
    // never brings any of it into view.
    const seen = new Set<string>();
    const roving = new Set(t.scenes.filter(movesCamera).map((sc) => sc.id));
    const inView = new Map<string, { b: LayerBox; t: number } | null>();
    const [W, H] = t.size;
    for (const m of auditMoments(t, roving)) {
      for (const b of await s.audit(m.t)) {
        const p = `scenes.${b.scene}.layers.${b.layer}`;
        const sides = (Object.entries(b.off) as [string, number][]).filter(([, px]) => px > 1);
        if (b.empty && !seen.has(`${p}:empty`)) {
          seen.add(`${p}:empty`);
          issues.push({ level: 'warning', code: 'empty-layer', path: p, t: m.t, message: `Layer "${b.layer}" has no size at ${m.t.toFixed(2)} s, so it shows nothing.` });
        } else if (roving.has(b.scene)) {
          const visible = b.x < W && b.x + b.width > 0 && b.y < H && b.y + b.height > 0;
          if (visible) inView.set(p, null);
          else if (!inView.has(p)) inView.set(p, { b, t: m.t });
        } else if (sides.length && !seen.has(`${p}:off`)) {
          seen.add(`${p}:off`);
          issues.push({ level: 'warning', code: 'off-stage', path: p, t: m.t, message: `Layer "${b.layer}" runs off the stage at ${m.t.toFixed(2)} s: ${sides.map(([side, px]) => `${px} px past the ${side}`).join(', ')}.`, hint: 'Shorten the text, pick a smaller style.size, or set style.width (in % of the stage). A placed layer is as wide as its text, up to style.width.' });
        }
      }
    }
    for (const [p, first] of inView) {
      if (!first) continue;
      issues.push({ level: 'warning', code: 'never-in-view', path: p, t: first.t, message: `Layer "${first.b.layer}" is never on stage: the camera does not bring it into view while it is shown.`, hint: 'Move it where the camera passes, move the camera to it, or remove it.' });
    }
    // 3. Layout must not flip: a layer whose own size (before transforms) changes and changes back
    // re-wraps a line or re-centres a block, and the eye sees the words jump. Sizes are sampled
    // through the film; a change that returns within a second is reported.
    const sizes = () => s.page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>('.m-scene')].flatMap((sc) =>
      [...sc.querySelectorAll<HTMLElement>('.m-layer')].filter((e) => e.checkVisibility()).map((e) => [`scenes.${sc.dataset.scene}.layers.${e.dataset.layer}`, `${e.offsetWidth}×${e.offsetHeight}`]))));
    const history = new Map<string, { t: number; size: string }[]>();
    const every = Math.max(1 / 12, t.duration / 240);
    for (let time = 0; time < t.duration; time += every) {
      await s.seek(Math.round(time * t.fps) / t.fps);
      for (const [p, size] of Object.entries(await sizes())) {
        const h = history.get(p) ?? [];
        if (h[h.length - 1]?.size !== size) h.push({ t: time, size });
        history.set(p, h);
      }
    }
    for (const [p, h] of history) {
      const flip = h.findIndex((x, k) => k >= 2 && h[k - 2]!.size === x.size && x.t - h[k - 1]!.t <= 1);
      if (flip < 0) continue;
      const [a, b] = [h[flip - 2]!, h[flip - 1]!];
      issues.push({ level: 'warning', code: 'relayout-flip', path: p, t: b.t, message: `Layer "${p.split('.').pop()}" changes its laid-out size from ${a.size} to ${b.size} at ${b.t.toFixed(2)} s and back by ${h[flip]!.t.toFixed(2)} s: a line re-wraps, and the words jump.`,
        hint: 'Lay text out whole from the first frame and reveal it with opacity or a mask; move things with transforms, never by changing size, zoom or font size.' });
    }
    // 4. A light motion pass: runs of consecutive frames inside each camera move, through the same
    // measures as `motion review`, so a wiggle or a jump shows before a render.
    const moving = t.scenes.filter(movesCamera);
    if (moving.length) {
      const decoder = await s.page.context().newPage();
      const [vw, vh] = t.size, k = 360 / Math.min(vw, vh), aw = Math.round((vw * k) / 2) * 2, ah = Math.round((vh * k) / 2) * 2;
      const gray = async (png: Buffer) => {
        const b64 = await decoder.evaluate(async ([data, w, h]) => {
          const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob(), { resizeWidth: w as number, resizeHeight: h as number, resizeQuality: 'medium' });
          const c = new OffscreenCanvas(w as number, h as number).getContext('2d')!;
          c.drawImage(bmp, 0, 0);
          const d = c.getImageData(0, 0, w as number, h as number).data, g = new Uint8Array((w as number) * (h as number));
          for (let i = 0; i < g.length; i++) g[i] = Math.round(0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!);
          let out = '';
          for (let i = 0; i < g.length; i += 0x8000) out += String.fromCharCode(...g.subarray(i, i + 0x8000));
          return btoa(out);
        }, [png.toString('base64'), aw, ah] as const);
        return Float32Array.from(Buffer.from(b64, 'base64'));
      };
      const reported = new Set<string>();
      try {
        for (const sc of moving) for (const at of [1 / 3, 2 / 3]) {
          const first = Math.round((sc.start + sc.length * at) * t.fps) - 6;
          if (first < 0 || first + 12 > t.frames) continue;
          const an = new Analyser(aw, ah, REFERENCE_SHORT / Math.min(aw, ah));
          for (let i = first; i < first + 12; i++) { await s.seek(i / t.fps); an.push(await gray(await s.page.screenshot({ type: 'png' }))); }
          for (const f of findings(an.result(), { fps: t.fps })) {
            if (f.level !== 'fault' || reported.has(`${sc.id}:${f.kind}`)) continue;
            reported.add(`${sc.id}:${f.kind}`);
            const time = (first + f.frame) / t.fps;
            issues.push({ level: 'warning', code: `motion-${f.kind}`, path: `scenes.${sc.id}`, t: Number(time.toFixed(2)), message: `At ${time.toFixed(2)} s: ${f.message}`,
              hint: 'This samples a few frames of each camera move; render and run motion review for the whole film.' });
          }
        }
      } finally { await decoder.close(); }
    }
    // 5. A loop's last frame must lead into its first as a normal frame leads into the next.
    if (args.flags.loop || readFilm(file).loop === true) loop = await seam(s, t);
    for (const e of s.errors) issues.push({ level: 'error', code: 'page-error', path: 'film', message: e });
  } finally { await s.close(); }
  const errors = issues.filter((i) => i.level === 'error').length;
  if (loop && !loop.seamless) {
    const still = loop.step < 0.05;
    issues.push({ level: 'warning', code: 'loop-seam', path: 'film', t: t.duration, message: `The loop jumps: last frame to first changes ${loop.seam} (mean per channel, 0–255), ${still ? 'while the frames at both ends hold still' : `${loop.ratio}× the largest frame-to-frame step around it (${loop.step})`}.`,
      hint: 'End each move where the film began, or end footage on the frame before the opening shot (el/video "continues").' });
  }
  if (json) print({ ok: errors === 0, file, duration: t.duration, frames: t.frames, issues, ...(loop ? { loop } : {}) });
  else {
    issues.forEach((i) => console.log(line(i)));
    if (loop) console.log(`Loop seam: last frame to first changes ${loop.seam}; the largest step nearby changes ${loop.step} (of ${loop.steps.length} steps at both ends)${loop.step >= 0.05 ? `, so the seam is ${loop.ratio}× a step` : ''}: ${loop.seamless ? 'seamless' : 'it shows'}.`);
    console.log(`${file}: ${errors ? `${errors} error(s)` : 'ok'}, ${issues.length - errors} warning(s). Frames repeat exactly: ${issues.some((i) => i.code === 'not-repeatable') ? 'NO' : 'yes'}.`);
  }
  if (errors) process.exit(1);
}

/** A scene whose camera moves: tracks that move or turn the whole scene, or a camera that follows a line. */
function movesCamera(sc: Timeline['scenes'][number]): boolean {
  const tr = sc.source.tracks ?? {};
  return !!sc.source.follow || (sc.camera?.length ?? 0) > 1 || !!sc.camera?.some((k) => k.drift) || (['x', 'y', 'scale', 'rotate', 'rotateX', 'rotateY'] as const).some((k) => (tr[k]?.length ?? 0) > 1);
}

/** Key moments, plus every quarter second of scenes whose camera moves. */
function auditMoments(t: Timeline, roving: Set<string>): { t: number; label: string }[] {
  const out = keyMoments(t), have = new Set(out.map((m) => Math.round(m.t * t.fps)));
  for (const sc of t.scenes) {
    if (!roving.has(sc.id)) continue;
    for (let x = sc.start; x < sc.end; x += 0.25) {
      const f = Math.min(t.frames - 1, Math.round(x * t.fps));
      if (!have.has(f)) { have.add(f); out.push({ t: f / t.fps, label: `${sc.id} camera` }); }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export interface Seam { seam: number; step: number; ratio: number; seamless: boolean; steps: number[] }

/**
 * How much the picture changes from the last frame to the first, next to how much
 * it changes from one frame to the next at both ends of the film. A raw score
 * misleads: handheld footage changes a lot every frame, a still title not at all.
 * The seam is held against the largest step nearby, not the usual one: footage shot at
 * 24 fps in a 60 fps film changes on two frames in five and holds on the rest, so its
 * usual step is nearly nothing while a sound seam is one of its real steps.
 */
async function seam(s: Session, t: Timeline): Promise<Seam> {
  const n = Math.min(Math.max(6, Math.ceil(t.fps / 5) + 1), Math.floor(t.frames / 2));
  const shot = async (f: number) => { await s.seek(f / t.fps); return (await s.page.screenshot({ type: 'png' })).toString('base64'); };
  const head: string[] = [], tail: string[] = [];
  for (let f = 0; f < n; f++) head.push(await shot(f));
  for (let f = t.frames - n; f < t.frames; f++) tail.push(await shot(f));
  const pairs: [string, string][] = [...tail.slice(0, -1).map((a, i) => [a, tail[i + 1]!] as [string, string]), ...head.slice(0, -1).map((a, i) => [a, head[i + 1]!] as [string, string]), [tail[tail.length - 1]!, head[0]!]];
  const page = await s.page.context().newPage();
  try {
    // One pair at a time: every frame is a PNG of several megabytes, and all of them in one call is more than a page takes.
    const diffs: number[] = [];
    for (const pair of pairs) {
      diffs.push(await page.evaluate(async ([a, b]) => {
        const pixels = async (b64: string) => {
          const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
          const w = 480, h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
          const c = new OffscreenCanvas(w, h), g = c.getContext('2d')!;
          g.drawImage(bmp, 0, 0, w, h);
          return g.getImageData(0, 0, w, h).data;
        };
        const [pa, pb] = await Promise.all([pixels(a!), pixels(b!)]);
        let sum = 0;
        for (let i = 0; i < pa.length; i += 4) sum += Math.abs(pa[i]! - pb[i]!) + Math.abs(pa[i + 1]! - pb[i + 1]!) + Math.abs(pa[i + 2]! - pb[i + 2]!);
        return sum / ((pa.length / 4) * 3);
      }, pair));
    }
    const r2 = (x: number) => Number(x.toFixed(2));
    const steps = diffs.slice(0, -1), sorted = [...steps].sort((a, b) => a - b);
    const step = sorted.length ? sorted[sorted.length - 1]! : 0, value = diffs[diffs.length - 1]!;
    // Seamless when the seam is no bigger than one and a half of the largest steps around it, or too small to see.
    return { seam: r2(value), step: r2(step), ratio: r2(value / Math.max(step, 0.05)), seamless: value <= Math.max(1.5 * step, 0.5), steps: steps.map(r2) };
  } finally { await page.close(); }
}

async function reviewCmd(args: Args) {
  const target = need(args), json = !!args.flags.json;
  let file = target, cuts: number[] | undefined, spans: [number, number][] | undefined, loop = !!args.flags.loop, out: string;
  if (/\.json$/i.test(target)) {
    // A film: review its render, judging cuts and hand-overs as the film declares them.
    const t = timelineOrExit(load(target, args), json);
    const dir = path.join(path.dirname(path.resolve(target)), 'out', filmName(target));
    file = typeof args.flags.video === 'string' ? path.resolve(args.flags.video) : path.join(dir, `${filmName(target)}-${t.size[0] - (t.size[0] % 2)}x${t.size[1] - (t.size[1] % 2)}-${t.fps}fps.mp4`);
    if (!fs.existsSync(file)) throw new Error(`No render at ${path.relative(process.cwd(), file)}. Run: motion render ${target}`);
    if (fs.statSync(file).mtimeMs < fs.statSync(target).mtimeMs) console.error(`warn: the render is older than ${path.basename(target)}; render again to review the film as it is now.`);
    ({ cuts, spans } = filmCuts(t));
    loop ||= t.loop === true;
    out = path.join(dir, 'review');
  } else {
    if (!fs.existsSync(target)) throw new Error(`${target} not found.`);
    out = path.join(path.dirname(path.resolve(target)), `${path.basename(target).replace(/\.[^.]+$/, '')}.review`);
  }
  const res = await review({ file, out, loop, ...(cuts ? { cuts } : {}), ...(spans ? { spans } : {}),
    ...(json ? {} : { onProgress: (d: number, n: number) => { if (d === n || d % 60 === 0) process.stderr.write(`\r  frame ${d}/${n}`); if (d === n) process.stderr.write('\n'); } }) });
  if (json) print(res); else console.log(describeReview(res));
  if (!res.ok) process.exit(1);
}

async function render(args: Args) {
  const file = need(args), l = load(file, args), t = timelineOrExit(l, false);
  const scale = Number(args.flags.scale ?? 1), crf = String(args.flags.crf ?? 15);
  const dir = path.join(path.dirname(path.resolve(file)), 'out', filmName(file));
  const out = path.resolve(typeof args.flags.out === 'string' ? args.flags.out : path.join(dir, `${filmName(file)}-${t.size[0]}x${t.size[1]}-${t.fps}fps.mp4`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const [w, h] = [t.size[0] - (t.size[0] % 2), t.size[1] - (t.size[1] % 2)]; // H.264 4:2:0 needs even sides
  const s = await open(file, { css: args.css, size: t.size, scale, timeline: t, ...browserOpt(args), ...(args.flags['no-tune'] ? { noTune: true } : {}) });
  // The soundtrack, cut to the film: from its `from`, as long as the film, faded and levelled.
  const a = t.audio, sound = a ? path.resolve(path.dirname(path.resolve(file)), a.src) : undefined;
  if (sound && !fs.existsSync(sound)) { console.error(`audio.src: ${a!.src} not found next to the film.`); process.exit(1); }
  const audioIn = a && sound ? ['-ss', String(a.from), '-t', String(t.duration), '-i', sound] : [];
  const audioOut = a && sound ? [
    '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k',
    // A few milliseconds of fade even when none is asked for, so the cut ends never click.
    '-af', [`volume=${a.gain}dB`, `afade=t=in:st=0:d=${Math.max(0.005, a.fade_in)}`, `afade=t=out:st=${Math.max(0, t.duration - Math.max(0.005, a.fade_out)).toFixed(4)}:d=${Math.max(0.005, a.fade_out)}`, `apad=whole_dur=${t.duration}`].join(','),
  ] : ['-an'];
  // Frames go to ffmpeg as PNG: JPEG's noise is different in every frame and crawls on fine type and
  // flat fills (the review's shimmer). --fast keeps JPEG for drafts, at about twice the speed.
  const fast = !!args.flags.fast;
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(t.fps), '-vcodec', fast ? 'mjpeg' : 'png', '-i', 'pipe:0', ...audioIn,
    '-vf', `scale=${w}:${h}:flags=lanczos+accurate_rnd+full_chroma_int:in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', ...audioOut, '-t', String(t.duration), out]);
  let ffErr = '';
  ff.stderr.on('data', (d: Buffer) => { ffErr += d.toString(); });
  const closed = once(ff, 'close');
  const started = Date.now();
  const still: [number, number][] = [];
  let runStart = -1, prev = '';
  try {
    for (let i = 0; i < t.frames; i++) {
      await s.seek(i / t.fps);
      const img = fast ? await s.page.screenshot({ type: 'jpeg', quality: 95 }) : await s.page.screenshot({ type: 'png' });
      const hash = createHash('sha1').update(img).digest('hex');
      if (hash === prev) { if (runStart < 0) runStart = i - 1; }
      else if (runStart >= 0) { still.push([runStart, i - 1]); runStart = -1; }
      prev = hash;
      if (!ff.stdin.write(img)) await once(ff.stdin, 'drain');
      if (i % t.fps === 0) process.stderr.write(`\r${i}/${t.frames} frames`);
    }
    if (runStart >= 0) still.push([runStart, t.frames - 1]);
    ff.stdin.end();
    const [code] = await closed as [number];
    process.stderr.write('\r');
    if (code !== 0) throw new Error(`ffmpeg failed: ${ffErr.trim()}`);
  } finally {
    await s.close();
    if (ff.exitCode === null) ff.kill();
  }
  // Runs of identical frames a second or longer: holds are expected, an unplanned freeze is not.
  const still_runs_s = still.filter(([a, b]) => b - a + 1 >= t.fps).map(([a, b]) => [Number((a / t.fps).toFixed(2)), Number(((b + 1) / t.fps).toFixed(2))]);
  const report = {
    file: out, size: `${w}x${h}`, fps: t.fps, frames: t.frames, duration_s: t.duration, megabytes: Number((fs.statSync(out).size / 1e6).toFixed(2)),
    supersample: scale, frames_as: fast ? 'jpeg' : 'png', render_s: Number(((Date.now() - started) / 1000).toFixed(1)), still_runs_s, page_errors: s.errors,
  };
  writeJson(out.replace(/\.mp4$/, '.report.json'), report);
  print(report);
  if (s.errors.length) process.exit(1);
}

async function build(args: Args) {
  const file = need(args), l = load(file, args);
  timelineOrExit(l, false);
  const js = fs.readFileSync(await bundle(), 'utf8');
  const data = JSON.stringify({ film: readFilm(file), tune: args.flags['no-tune'] ? {} : readTune(file) }).replace(/</g, '\\u003c');
  const head = args.css.map((f) => `<style>${inlineCss(path.resolve(f))}</style>`).join('\n');
  const out = path.resolve(typeof args.flags.out === 'string' ? args.flags.out : path.join(path.dirname(path.resolve(file)), 'out', filmName(file), `${filmName(file)}.html`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, shell(head, `<script type="application/json" id="film-data">${data}</script>\n<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script>`));
  console.log(`${path.relative(process.cwd(), out)} written. Open it to play the film; add #render for the bare stage.`);
}

async function wizard(args: Args) {
  const html = await wizardPage({ catalog: buildCatalog(), library: readLibrary() });
  if (typeof args.flags.out === 'string') {
    fs.mkdirSync(path.dirname(path.resolve(args.flags.out)), { recursive: true });
    fs.writeFileSync(args.flags.out, html);
    return console.log(`${args.flags.out} written. It is one file: open it, or share it.`);
  }
  const http = await import('node:http');
  const port = Number(args.flags.port ?? 4322);
  const server = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(html); });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  console.log(`Wizard: http://127.0.0.1:${port}\nAnswer the questions, then copy the brief into Claude or ChatGPT. Ctrl+C stops it.`);
}

function briefCmd(args: Args) {
  const file = need(args);
  const answers = readJson<Answers>(file);
  const ctx = { catalog: buildCatalog(), library: readLibrary() };
  const problems = checkAnswers(answers, ctx);
  if (problems.length) { problems.forEach((p) => console.error(`ERROR ${p}`)); process.exit(1); }
  const text = writeBrief(answers, ctx);
  if (typeof args.flags.out === 'string') { fs.writeFileSync(args.flags.out, text); console.log(`${args.flags.out} written`); }
  else process.stdout.write(text);
}

function bakeCmd(args: Args) {
  const file = need(args), result = bake(readFilm(file), readTune(file));
  const res = resolveFilm(result.film);
  if (!res.ok) { res.issues.forEach((i) => console.error(line(i))); throw new Error('The tuned film has errors, so nothing was written.'); }
  writeJson(file, result.film);
  writeJson(tunePath(file), result.tune);
  console.log(`Tuning written into ${file}.${result.orphans.length ? ` ${result.orphans.length} override(s) pointed at nothing and were left in the tune file.` : ''} Notes were kept.`);
}

export async function main(argv: string[]) {
  const args = parse(argv);
  const cmd = args._[0];
  if (!cmd || args.flags.help) return console.log(HELP);
  if (cmd === 'catalog') return catalog(args);
  if (cmd === 'make') return make(args);
  if (cmd === 'capture') return captureCmd(args);
  if (cmd === 'record') return recordCmd(args);
  if (cmd === 'validate') return validate(args);
  if (cmd === 'inspect') return inspect(args);
  if (cmd === 'pace') return paceCmd(args);
  if (cmd === 'beats') return beatsCmd(args);
  if (cmd === 'import') return importCmd(args);
  if (cmd === 'notes') return notes(args);
  if (cmd === 'preview') return preview(args);
  if (cmd === 'stills') return stills(args);
  if (cmd === 'check') return check(args);
  if (cmd === 'review') return reviewCmd(args);
  if (cmd === 'render') return render(args);
  if (cmd === 'build') return build(args);
  if (cmd === 'bake') return bakeCmd(args);
  if (cmd === 'brief') return briefCmd(args);
  if (cmd === 'wizard') return wizard(args);
  if (cmd === 'bundle') { await bundle(path.resolve('dist')); return console.log('dist/page.js and dist/motion.js written'); }
  throw new Error(`Unknown command "${cmd}".\n\n${HELP}`);
}
