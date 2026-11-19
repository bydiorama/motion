// Footage of a live web page, frame by frame, on a clock the recorder keeps.
// The page's timers, requestAnimationFrame, Date and performance.now run on a
// virtual clock that only moves when a frame is taken, and every CSS and Web
// Animations animation on the page is held and set to its time on that clock,
// so a component's own motion lands on whole frames and records the same
// every time, however slow the screenshots are. The frames go to a folder, and
// through ffmpeg to an MP4 for an el/video layer.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { browserPath, launch } from './browser.ts';
import { GUARD, MARKS, guardFindings, type GuardSample, type Marks } from './guard.ts';

export interface RecordOptions {
  url: string;
  /** An .mp4 file, or a folder for numbered frames. */
  out: string;
  /** Seconds of footage. */
  duration: number;
  fps: number;
  size: [number, number];
  /** Device pixels per CSS pixel. */
  scale: number;
  scheme: 'light' | 'dark';
  /** Seconds the page runs on the virtual clock before the first frame. */
  lead: number;
  /** Quality of the MP4: x264's constant rate factor, lower is better. */
  crf: number;
  browser?: string;
  /** Watch the page for layout moves, re-wraps, CSS zoom and scaled stages (on unless false). */
  guard?: boolean;
  /** CSS selectors whose boxes are written, frame by frame, to `<out>.marks.json`. */
  marks?: string[];
  onProgress?: (done: number, total: number) => void;
}

export interface Recorded {
  out: string; frames: number; size: [number, number]; errors: string[];
  /** What the guard saw, each line starting `guard:`. Empty: the page moved by transforms only. */
  guard: string[];
  /** The marks file, when marks were asked for. */
  marks?: string;
}

/** Milliseconds the clock moves before frame i, so frame i lands on round(i × 1000 / fps). */
export function clockSteps(frames: number, fps: number): number[] {
  const at = (i: number) => Math.round((i * 1000) / fps);
  return Array.from({ length: frames }, (_, i) => at(i) - (i ? at(i - 1) : 0));
}

// Runs in the page. Every animation the page has gets a birth on the virtual
// clock the first time it is seen; from then on it is held (a rate too small to
// move between two screenshots, so it stays "running" and its finished promise
// still resolves) and its time is set from the clock. Reading layout first
// starts the CSS transitions that the last state change asked for.
const SYNC = `(() => {
  const w = window;
  const born = w.__motionBorn || (w.__motionBorn = new WeakMap());
  const now = performance.now();
  void document.documentElement.offsetHeight;
  for (const a of document.getAnimations()) {
    let b = born.get(a);
    if (!b) { b = { at: now, rate: a.playbackRate || 1 }; born.set(a, b); }
    if (a.playState === 'finished') continue;
    a.playbackRate = 1e-9;
    a.currentTime = (now - b.at) * b.rate;
  }
  void document.documentElement.offsetHeight;
})()`;

// Runs in the page before anything else. The virtual clock fires requestAnimationFrame on a 16 ms
// grid, so at 60 fps one frame in 24 gets two callbacks and the page's motion skips ahead. Instead
// the recorder runs the queued callbacks itself, once per frame, at the frame's time.
export const FRAMES = `(() => {
  const w = window;
  let queue = new Map(), next = 1;
  w.requestAnimationFrame = (cb) => { const id = next++; queue.set(id, cb); return id; };
  w.cancelAnimationFrame = (id) => { queue.delete(id); };
  w.__motionFrame = () => {
    const now = performance.now(), run = queue;
    queue = new Map();
    for (const cb of run.values()) { try { cb(now); } catch (e) { setTimeout(() => { throw e; }); } }
  };
})()`;

function encode(dir: string, fps: number, file: string, crf: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let err = '';
    const p = spawn('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%05d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file]);
    p.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    p.on('error', (e) => reject(new Error(`An MP4 needs ffmpeg (${e.message}). Install it, or record to a folder of frames.`)));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg could not write ${file}:\n${err.trim()}`))));
  });
}

export async function record(o: RecordOptions): Promise<Recorded> {
  const mp4 = /\.mp4$/i.test(o.out);
  const dir = mp4 ? `${o.out.replace(/\.mp4$/i, '')}.frames` : o.out;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const browser = await launch(browserPath(o.browser));
  const errors: string[] = [];
  const frames = Math.max(1, Math.round(o.duration * o.fps));
  const guarding = o.guard !== false;
  const samples: GuardSample[] = [];
  const marks: Marks | undefined = o.marks?.length
    ? { fps: o.fps, size: [Math.round(o.size[0] * o.scale), Math.round(o.size[1] * o.scale)], marks: Object.fromEntries(o.marks.map((m) => [m, []])) }
    : undefined;
  try {
    const page = await browser.newPage({
      viewport: { width: o.size[0], height: o.size[1] }, deviceScaleFactor: o.scale,
      colorScheme: o.scheme, reducedMotion: 'no-preference',
    });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    // The page starts on the virtual clock, paused, so nothing moves until a frame is taken.
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(0);
    await page.addInitScript(FRAMES);
    if (guarding) await page.addInitScript(GUARD);
    await page.goto(o.url, { waitUntil: 'load', timeout: 60_000 });
    // Every face the page declares, loaded now: a face first asked for mid-recording would
    // hold a screenshot until it arrives.
    await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load().catch(() => undefined))).then(() => document.fonts.ready).then(() => undefined));
    await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))));
    // A page may export recordStart(): called once, at time zero of the footage.
    const frame = () => page.evaluate(() => (window as unknown as { __motionFrame?: () => void }).__motionFrame?.());
    if (o.lead > 0) { await page.clock.runFor(Math.round(o.lead * 1000)); await frame(); await page.evaluate(SYNC); }
    await page.evaluate(() => (window as unknown as { recordStart?: () => void }).recordStart?.());
    const steps = clockSteps(frames, o.fps);
    for (let i = 0; i < frames; i++) {
      if (steps[i]) await page.clock.runFor(steps[i]!);
      await frame();
      // Let React and friends commit what the timers changed (they post messages, which the clock does not hold).
      await page.evaluate(() => new Promise<void>((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }));
      await page.evaluate(SYNC);
      const file = path.join(dir, `f${String(i).padStart(5, '0')}.png`);
      try { await page.screenshot({ path: file, animations: 'allow', timeout: 15_000 }); } catch {
        // A late resource (a font, an image) can hold one screenshot; give it a moment in real time, once.
        await page.waitForTimeout(500);
        await page.evaluate(SYNC);
        await page.screenshot({ path: file, animations: 'allow', timeout: 30_000 });
      }
      if (guarding) samples.push(await page.evaluate(() => (window as unknown as { __motionGuard: () => GuardSample }).__motionGuard()));
      if (marks) {
        const at = await page.evaluate(`${MARKS}(${JSON.stringify(o.marks)}, ${o.scale})`) as Record<string, [number, number, number, number] | null>;
        for (const [sel, box] of Object.entries(at)) marks.marks[sel]!.push(box);
      }
      o.onProgress?.(i + 1, frames);
    }
  } finally {
    await browser.close();
  }
  if (mp4) {
    await encode(dir, o.fps, o.out, o.crf);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  let marksFile: string | undefined;
  if (marks) {
    marksFile = `${o.out.replace(/\.mp4$/i, '').replace(/[\\/]$/, '')}.marks.json`;
    fs.writeFileSync(marksFile, JSON.stringify(marks));
  }
  return { out: mp4 ? o.out : dir, frames, size: [Math.round(o.size[0] * o.scale), Math.round(o.size[1] * o.scale)], errors, guard: guardFindings(samples, o.fps), ...(marksFile ? { marks: marksFile } : {}) };
}
