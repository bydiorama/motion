// motion review: reads a video frame by frame and reports what a viewer would
// feel but a contact sheet hides: a camera that wiggles, jumps or stalls, parts
// of the picture floating against the rest, and frames that blink, flicker or
// shimmer. See src/review/measure.ts for what each finding means.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Analyser, findings, REFERENCE_SHORT, shimmerLevel, type Analysis, type Finding } from '../review/measure.ts';
import type { Timeline } from '../film/types.ts';

/** The shorter side frames are analysed at. */
const ANALYSIS_SHORT = 360;

export interface VideoInfo { width: number; height: number; fps: number; frames: number }

export function probe(file: string): VideoInfo {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_packets', '-of', 'json', file], { encoding: 'utf8' });
  if (r.error) throw new Error(`Reviewing a video needs ffprobe, which comes with ffmpeg (${r.error.message}).`);
  if (r.status !== 0) throw new Error(`ffprobe could not read ${file}: ${r.stderr.trim()}`);
  const s = JSON.parse(r.stdout).streams?.[0];
  if (!s) throw new Error(`${file} has no video stream.`);
  const [n, d] = String(s.r_frame_rate).split('/').map(Number);
  return { width: s.width, height: s.height, fps: d ? n! / d : n!, frames: Number(s.nb_read_packets) };
}

/** Cuts, hand-overs and camera punches from a film's timeline, as frames: a punch jumps on purpose. */
export function filmCuts(t: Timeline): { cuts: number[]; spans: [number, number][] } {
  const cuts: number[] = [], spans: [number, number][] = [];
  t.scenes.forEach((s, k) => {
    // A punch-in: a camera move on `punch`, or any move of a quarter second or less.
    (s.camera ?? []).forEach((b, i) => {
      const a = s.camera![i - 1];
      if (a && b.t > a.t && (b.ease === 'punch' || b.t - a.t <= 0.25 + 1e-6)) spans.push([Math.round((s.start + a.t) * t.fps), Math.round((s.start + b.t) * t.fps) + 1]);
    });
    if (k === 0) return;
    const before = t.scenes[k - 1]!;
    const f = Math.round(s.start * t.fps);
    if (before.out && before.out.duration > 0) spans.push([f, Math.round((s.start + before.out.duration) * t.fps)]);
    else cuts.push(f);
  });
  return { cuts, spans };
}

export interface ReviewOptions {
  file: string;
  out: string;
  /** Cuts and hand-overs the film declares. */
  cuts?: number[];
  spans?: [number, number][];
  /** The video loops: also judge the step from the last frame to the first. */
  loop?: boolean;
  onProgress?: (done: number, total: number) => void;
}

export interface Review {
  file: string; size: [number, number]; fps: number; frames: number;
  ok: boolean;
  findings: Finding[];
  shimmer: { median: number; p95: number };
  /** Peak camera speed in px per frame at 1080, and the largest zoom step in % per frame. */
  camera: { peak_px: number; peak_zoom_pct: number };
  graph: string;
  strips: string[];
}

export async function review(o: ReviewOptions): Promise<Review> {
  const info = probe(o.file);
  const k = ANALYSIS_SHORT / Math.min(info.width, info.height);
  const w = Math.round((info.width * k) / 2) * 2, h = Math.round((info.height * k) / 2) * 2;
  const a = new Analyser(w, h, REFERENCE_SHORT / Math.min(w, h));
  const head: Float32Array[] = [];
  await new Promise<void>((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', o.file, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
    const size = w * h;
    let buf: Buffer = Buffer.alloc(0), n = 0, err = '';
    ff.stdout.on('data', (d: Buffer) => {
      buf = buf.length ? Buffer.concat([buf, d]) : d;
      while (buf.length >= size) {
        const f = new Float32Array(size);
        for (let i = 0; i < size; i++) f[i] = buf[i]!;
        buf = buf.subarray(size);
        a.push(f);
        if (o.loop && head.length < 3) head.push(f);
        o.onProgress?.(++n, info.frames);
      }
    });
    ff.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    ff.on('error', (e) => reject(new Error(`Reviewing a video needs ffmpeg (${e.message}).`)));
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg could not read ${o.file}:\n${err.trim()}`))));
  });
  // A loop: run on into its own opening, so the seam is judged like any other step.
  for (const f of head) a.push(f);
  const an = a.result();
  const found = findings(an, { fps: info.fps, ...(o.cuts ? { cuts: o.cuts } : {}), ...(o.spans ? { spans: o.spans } : {}) })
    .map((f) => (f.frame >= info.frames ? { ...f, message: `${f.message} (across the loop seam)` } : f));
  fs.rmSync(o.out, { recursive: true, force: true });
  fs.mkdirSync(o.out, { recursive: true });
  const graph = path.join(o.out, 'motion.svg');
  fs.writeFileSync(graph, motionGraph(an, found, info, o.cuts ?? []));
  const strips = writeStrips(o.file, o.out, found, info);
  const cams = an.steps.filter((s) => s.cam);
  const res: Review = {
    file: o.file, size: [info.width, info.height], fps: info.fps, frames: info.frames,
    ok: !found.some((f) => f.level === 'fault'), findings: found, shimmer: shimmerLevel(an),
    camera: {
      peak_px: round1(Math.max(0, ...cams.map((s) => Math.hypot(s.cam!.tx, s.cam!.ty) * an.scale))),
      peak_zoom_pct: round1(Math.max(0, ...cams.map((s) => Math.abs(s.cam!.zoom) * 100))),
    },
    graph, strips,
  };
  fs.writeFileSync(path.join(o.out, 'review.json'), JSON.stringify(res, null, 2));
  return res;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Five frames around each finding, side by side, for a person to look at. */
function writeStrips(file: string, dir: string, found: Finding[], info: VideoInfo): string[] {
  const shown = [...found.filter((f) => f.level === 'fault'), ...found.filter((f) => f.level === 'note')].slice(0, 16);
  const out: string[] = [];
  for (const f of shown) {
    const first = Math.max(0, Math.min(info.frames - 5, f.frame - 2));
    const name = path.join(dir, `${f.t.toFixed(2).padStart(6, '0')}-${f.kind}.png`);
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `select='between(n\\,${first}\\,${first + 4})',scale=-2:480,tile=5x1:padding=6:color=0x15171b`, '-frames:v', '1', '-fps_mode', 'passthrough', name]);
    if (r.status === 0) out.push(name);
  }
  return out;
}

/** The camera's motion over time, with findings and cuts marked. */
function motionGraph(a: Analysis, found: Finding[], info: VideoInfo, cuts: number[]): string {
  const W = 1600, H = 420, pad = 40, n = Math.max(1, a.frames - 1);
  const X = (i: number) => pad + ((W - 2 * pad) * i) / n;
  const steps = a.steps.filter((s) => s.cam);
  const peak = Math.max(4, ...steps.map((s) => Math.max(Math.abs(s.cam!.tx), Math.abs(s.cam!.ty), Math.abs(s.cam!.zoom) * Math.min(a.w, a.h) / 2) * a.scale));
  const Y = (v: number) => H / 2 - (v / peak) * (H / 2 - pad);
  const line = (get: (s: (typeof steps)[number]) => number, color: string) =>
    `<polyline fill="none" stroke="${color}" stroke-width="1.2" points="${steps.map((s) => `${X(s.i).toFixed(1)},${Y(get(s) * a.scale).toFixed(1)}`).join(' ')}"/>`;
  const colour: Record<string, string> = { wiggle: '#ff5a5a', judder: '#ff7ab8', hitch: '#ffb36b', jump: '#ff9b3d', stall: '#ffd23d', floating: '#e35bff', blip: '#ff5a5a', flicker: '#9aa3ff', shimmer: '#7fd0ff', impact: '#6b7280' };
  const marks = found.map((f) => `<rect x="${X(f.frame).toFixed(1)}" y="${pad}" width="${Math.max(2, X(f.to) - X(f.frame)).toFixed(1)}" height="${H - 2 * pad}" fill="${colour[f.kind]}" opacity="0.25"><title>${f.t.toFixed(2)} s ${f.kind}: ${f.message.replace(/[<&]/g, '')}</title></rect>`).join('');
  const cutLines = cuts.map((c) => `<line x1="${X(c)}" x2="${X(c)}" y1="${pad}" y2="${H - pad}" stroke="#4b5563" stroke-dasharray="3 3"/>`).join('');
  const ticks = Array.from({ length: Math.floor(n / info.fps) + 1 }, (_, s) => `<text x="${X(s * info.fps)}" y="${H - 14}" fill="#9ca3af" font-size="11" text-anchor="middle">${s}s</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, sans-serif">
<rect width="${W}" height="${H}" fill="#15171b"/>${marks}${cutLines}
<line x1="${pad}" x2="${W - pad}" y1="${H / 2}" y2="${H / 2}" stroke="#374151"/>
${line((s) => s.cam!.tx, '#7fd0ff')}${line((s) => s.cam!.ty, '#b8f27c')}${line((s) => s.cam!.zoom * Math.min(a.w, a.h) / 2, '#f4c06a')}
${ticks}
<text x="${pad}" y="22" fill="#e5e7eb" font-size="13">Camera per frame (px at 1080, ±${peak.toFixed(1)}): <tspan fill="#7fd0ff">across</tspan> · <tspan fill="#b8f27c">down</tspan> · <tspan fill="#f4c06a">zoom at the edge</tspan>. Shaded: findings. Dashed: cuts.</text>
</svg>`;
}

export function describe(r: Review): string {
  const lines = r.findings.map((f) => `  ${f.t.toFixed(2).padStart(6)} s  ${f.level === 'fault' ? 'FAULT' : 'note '}  ${f.kind.padEnd(8)} ${f.message}${f.at ? ` At ${f.at[0]}% across, ${f.at[1]}% down.` : ''}`);
  const faults = r.findings.filter((f) => f.level === 'fault').length;
  return [
    `${path.basename(r.file)}: ${r.frames} frames at ${r.fps} fps, ${r.size[0]}×${r.size[1]}`,
    ...lines,
    `Camera: up to ${r.camera.peak_px} px and ${r.camera.peak_zoom_pct}% zoom a frame. Still detail changes ${r.shimmer.median} levels a frame (95th percentile ${r.shimmer.p95}).`,
    `Graph: ${r.graph}${r.strips.length ? `\nFrames around findings: ${path.dirname(r.strips[0]!)}/` : ''}`,
    faults ? `${faults} fault(s): the motion is not coherent. Fix each, or name it when you hand the film over.` : 'No faults: no wiggle, judder, jump, hitch, stall, floating or blip.',
  ].join('\n');
}
