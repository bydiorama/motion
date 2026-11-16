// The command line. Every command that reports on a film can print JSON
// (--json), so an agent reads results as data and a person reads them as text.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { buildCatalog } from '../catalog.ts';
import { describeTimeline, resolveFilm, type Resolution } from '../film/resolve.ts';
import { applyTune, bake } from '../film/tune.ts';
import type { Issue, Timeline } from '../film/types.ts';
import { open } from './browser.ts';
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
  validate <film...> [--json]       Check films without a browser
  inspect <film> [--json]           The resolved timeline: where every scene and layer lands
  notes <film> [--json]             The person's open notes, with where each one points

Look
  preview <film> [--port n]         The studio: scrub, tune, pin notes. Saves <film>.tune.json
  stills <film> [--at 1.2,3] [--scale n]   Frames as PNG plus a contact sheet, in out/<film>/
  check <film> [--json]             Draw it and test: repeatable frames, layers on stage, page errors

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
  const BOOL = new Set(['json', 'write', 'check', 'no-tune', 'help']);
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
  const s = await open(file, { css: args.css, size: t.size, scale: Number(args.flags.scale ?? 1) });
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
  const s = await open(file, { css: args.css, size: t.size });
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
    // 2. Layers must be on the stage and have a size once they have settled.
    const seen = new Set<string>();
    for (const m of keyMoments(t)) {
      for (const b of await s.audit(m.t)) {
        const p = `scenes.${b.scene}.layers.${b.layer}`;
        const sides = (Object.entries(b.off) as [string, number][]).filter(([, px]) => px > 1);
        if (b.empty && !seen.has(`${p}:empty`)) {
          seen.add(`${p}:empty`);
          issues.push({ level: 'warning', code: 'empty-layer', path: p, t: m.t, message: `Layer "${b.layer}" has no size at ${m.t.toFixed(2)} s, so it shows nothing.` });
        // A scene with a camera is a world the camera travels over: what lies outside the frame is the next thing it shows.
        } else if (sides.length && !b.world && !seen.has(`${p}:off`)) {
          seen.add(`${p}:off`);
          issues.push({ level: 'warning', code: 'off-stage', path: p, t: m.t, message: `Layer "${b.layer}" runs off the stage at ${m.t.toFixed(2)} s: ${sides.map(([side, px]) => `${px} px past the ${side}`).join(', ')}.`, hint: 'Shorten the text, pick a smaller style.size, or set style.width.' });
        }
      }
    }
    for (const e of s.errors) issues.push({ level: 'error', code: 'page-error', path: 'film', message: e });
  } finally { await s.close(); }
  const errors = issues.filter((i) => i.level === 'error').length;
  if (json) print({ ok: errors === 0, file, duration: t.duration, frames: t.frames, issues });
  else {
    issues.forEach((i) => console.log(line(i)));
    console.log(`${file}: ${errors ? `${errors} error(s)` : 'ok'}, ${issues.length - errors} warning(s). Frames repeat exactly: ${issues.some((i) => i.code === 'not-repeatable') ? 'NO' : 'yes'}.`);
  }
  if (errors) process.exit(1);
}

async function render(args: Args) {
  const file = need(args), l = load(file, args), t = timelineOrExit(l, false);
  const scale = Number(args.flags.scale ?? 1), crf = String(args.flags.crf ?? 15);
  const dir = path.join(path.dirname(path.resolve(file)), 'out', filmName(file));
  const out = path.resolve(typeof args.flags.out === 'string' ? args.flags.out : path.join(dir, `${filmName(file)}-${t.size[0]}x${t.size[1]}-${t.fps}fps.mp4`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const [w, h] = [t.size[0] - (t.size[0] % 2), t.size[1] - (t.size[1] % 2)]; // H.264 4:2:0 needs even sides
  const s = await open(file, { css: args.css, size: t.size, scale });
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
