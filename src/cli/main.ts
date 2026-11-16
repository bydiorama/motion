// The command line. Every command that reports on a film can print JSON
// (--json), so an agent reads results as data and a person reads them as text.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCatalog } from '../catalog.ts';
import { describeTimeline, resolveFilm, type Resolution } from '../film/resolve.ts';
import { applyTune, bake } from '../film/tune.ts';
import type { Issue, Timeline } from '../film/types.ts';
import { open, type Session } from './browser.ts';
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
  inspect <film> [--json]           The resolved timeline: where every scene and layer lands
  notes <film> [--json]             The person's open notes, with where each one points

Look
  preview <film> [--port n]         The studio: scrub, tune, pin notes. Saves <film>.tune.json
  stills <film> [--at 1.2,3] [--scale n]   Frames as PNG plus a contact sheet, in out/<film>/
  check <film> [--json] [--loop]    Draw it and test: repeatable frames, layers on stage, page errors;
                                    --loop (or "loop": true) measures the seam from last frame to first

Deliver
  render <film> [--out file.mp4] [--scale 2] [--crf 15]   MP4 through ffmpeg, plus a report
  build <film> [--out file.html]    One self-contained page that plays the film
  bake <film>                       Write the tuning into the film and empty the tune file

Options for every command that draws
  --css <file>    A stylesheet to load, e.g. a bydiorama/ui theme. Repeat for more.
  --no-tune       Ignore <film>.tune.json
`;

interface Args { _: string[]; flags: Record<string, string | boolean>; css: string[] }

function parse(argv: string[]): Args {
  const out: Args = { _: [], flags: {}, css: [] };
  const BOOL = new Set(['json', 'write', 'check', 'no-tune', 'help', 'loop', 'sections', 'keep-banners', 'keep-header']);
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

async function make(args: Args) {
  const script = need(args), json = !!args.flags.json;
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

function validate(args: Args) {
  const files = args._.slice(1);
  if (!files.length) throw new Error('Name one or more film files.');
  const results = files.map((f) => load(f, args));
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
  const s = await open(file, { css: args.css, size: t.size, scale: Number(args.flags.scale ?? 1), timeline: t, ...browserOpt(args) });
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

async function check(args: Args) {
  const file = need(args), json = !!args.flags.json, l = load(file, args), t = timelineOrExit(l, json);
  const issues: (Issue & { t?: number })[] = [...l.res.issues];
  let loop: Seam | undefined;
  const s = await open(file, { css: args.css, size: t.size, timeline: t, ...browserOpt(args) });
  try {
    // 1. A frame must depend on its time alone: draw the same moments in two orders and compare.
    const times = Array.from({ length: 6 }, (_, k) => Math.round((t.duration * k / 5) * t.fps) / t.fps);
    const shot = async (time: number) => { await s.seek(time); return createHash('sha1').update(await s.page.screenshot({ type: 'png' })).digest('hex'); };
    const forward = new Map<number, string>();
    for (const time of times) forward.set(time, await shot(time));
    for (const time of [...times].reverse()) {
      if ((await shot(time)) !== forward.get(time)) issues.push({ level: 'error', code: 'not-repeatable', path: 'film', t: time, message: `The frame at ${time.toFixed(2)} s differs depending on what was drawn before it.`, hint: 'A primitive keeps state between seeks, or uses a clock or unseeded randomness.' });
    }
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
    // 3. A loop's last frame must lead into its first as a normal frame leads into the next.
    if (args.flags.loop || readFilm(file).loop === true) loop = await seam(s, t);
    for (const e of s.errors) issues.push({ level: 'error', code: 'page-error', path: 'film', message: e });
  } finally { await s.close(); }
  const errors = issues.filter((i) => i.level === 'error').length;
  if (loop && !loop.seamless) {
    const still = loop.step < 0.05;
    issues.push({ level: 'warning', code: 'loop-seam', path: 'film', t: t.duration, message: `The loop jumps: last frame to first changes ${loop.seam} (mean per channel, 0–255), ${still ? 'while the frames at both ends hold still' : `${loop.ratio}× a normal frame-to-frame step here (${loop.step})`}.`,
      hint: 'End each move where the film began, or end footage on the frame before the opening shot (el/video "continues").' });
  }
  if (json) print({ ok: errors === 0, file, duration: t.duration, frames: t.frames, issues, ...(loop ? { loop } : {}) });
  else {
    issues.forEach((i) => console.log(line(i)));
    if (loop) console.log(`Loop seam: last frame to first changes ${loop.seam}; a normal step changes ${loop.step} (median of ${loop.steps.length} steps at both ends)${loop.step >= 0.05 ? `, so the seam is ${loop.ratio}× a step` : ''}: ${loop.seamless ? 'seamless' : 'it shows'}.`);
    console.log(`${file}: ${errors ? `${errors} error(s)` : 'ok'}, ${issues.length - errors} warning(s). Frames repeat exactly: ${issues.some((i) => i.code === 'not-repeatable') ? 'NO' : 'yes'}.`);
  }
  if (errors) process.exit(1);
}

/** A scene whose camera moves: tracks that move or turn the whole scene, or a camera that follows a line. */
function movesCamera(sc: Timeline['scenes'][number]): boolean {
  const tr = sc.source.tracks ?? {};
  return !!sc.source.follow || (['x', 'y', 'scale', 'rotate', 'rotateX', 'rotateY'] as const).some((k) => (tr[k]?.length ?? 0) > 1);
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
 */
async function seam(s: Session, t: Timeline): Promise<Seam> {
  const n = Math.min(6, Math.floor(t.frames / 2));
  const shot = async (f: number) => { await s.seek(f / t.fps); return (await s.page.screenshot({ type: 'png' })).toString('base64'); };
  const head: string[] = [], tail: string[] = [];
  for (let f = 0; f < n; f++) head.push(await shot(f));
  for (let f = t.frames - n; f < t.frames; f++) tail.push(await shot(f));
  const pairs: [string, string][] = [...tail.slice(0, -1).map((a, i) => [a, tail[i + 1]!] as [string, string]), ...head.slice(0, -1).map((a, i) => [a, head[i + 1]!] as [string, string]), [tail[tail.length - 1]!, head[0]!]];
  const page = await s.page.context().newPage();
  try {
    const diffs = await page.evaluate(async (list) => {
      const pixels = async (b64: string) => {
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const w = 480, h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
        const c = new OffscreenCanvas(w, h), g = c.getContext('2d')!;
        g.drawImage(bmp, 0, 0, w, h);
        return g.getImageData(0, 0, w, h).data;
      };
      const out: number[] = [];
      for (const [a, b] of list) {
        const [pa, pb] = await Promise.all([pixels(a), pixels(b)]);
        let sum = 0;
        for (let i = 0; i < pa.length; i += 4) sum += Math.abs(pa[i]! - pb[i]!) + Math.abs(pa[i + 1]! - pb[i + 1]!) + Math.abs(pa[i + 2]! - pb[i + 2]!);
        out.push(sum / ((pa.length / 4) * 3));
      }
      return out;
    }, pairs);
    const r2 = (x: number) => Number(x.toFixed(2));
    const steps = diffs.slice(0, -1), sorted = [...steps].sort((a, b) => a - b);
    const step = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0, value = diffs[diffs.length - 1]!;
    // Seamless when the seam is no bigger than a frame step and a half, or too small to see.
    return { seam: r2(value), step: r2(step), ratio: r2(value / Math.max(step, 0.05)), seamless: value <= Math.max(1.5 * step, 0.5), steps: steps.map(r2) };
  } finally { await page.close(); }
}

async function render(args: Args) {
  const file = need(args), l = load(file, args), t = timelineOrExit(l, false);
  const scale = Number(args.flags.scale ?? 1), crf = String(args.flags.crf ?? 15);
  const dir = path.join(path.dirname(path.resolve(file)), 'out', filmName(file));
  const out = path.resolve(typeof args.flags.out === 'string' ? args.flags.out : path.join(dir, `${filmName(file)}-${t.size[0]}x${t.size[1]}-${t.fps}fps.mp4`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const [w, h] = [t.size[0] - (t.size[0] % 2), t.size[1] - (t.size[1] % 2)]; // H.264 4:2:0 needs even sides
  const s = await open(file, { css: args.css, size: t.size, scale, timeline: t, ...browserOpt(args) });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(t.fps), '-vcodec', 'mjpeg', '-i', 'pipe:0',
    '-vf', `scale=${w}:${h}:flags=lanczos+accurate_rnd+full_chroma_int:in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-an', out]);
  let ffErr = '';
  ff.stderr.on('data', (d: Buffer) => { ffErr += d.toString(); });
  const closed = once(ff, 'close');
  const started = Date.now();
  const still: [number, number][] = [];
  let runStart = -1, prev = '';
  try {
    for (let i = 0; i < t.frames; i++) {
      await s.seek(i / t.fps);
      const jpg = await s.page.screenshot({ type: 'jpeg', quality: 95 });
      const hash = createHash('sha1').update(jpg).digest('hex');
      if (hash === prev) { if (runStart < 0) runStart = i - 1; }
      else if (runStart >= 0) { still.push([runStart, i - 1]); runStart = -1; }
      prev = hash;
      if (!ff.stdin.write(jpg)) await once(ff.stdin, 'drain');
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
    supersample: scale, render_s: Number(((Date.now() - started) / 1000).toFixed(1)), still_runs_s, page_errors: s.errors,
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
  if (cmd === 'validate') return validate(args);
  if (cmd === 'inspect') return inspect(args);
  if (cmd === 'notes') return notes(args);
  if (cmd === 'preview') return preview(args);
  if (cmd === 'stills') return stills(args);
  if (cmd === 'check') return check(args);
  if (cmd === 'render') return render(args);
  if (cmd === 'build') return build(args);
  if (cmd === 'bake') return bakeCmd(args);
  if (cmd === 'brief') return briefCmd(args);
  if (cmd === 'wizard') return wizard(args);
  if (cmd === 'bundle') { await bundle(); return console.log('dist/page.js and dist/motion.js written'); }
  throw new Error(`Unknown command "${cmd}".\n\n${HELP}`);
}
