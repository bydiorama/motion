// Footage for renders. Every el/video layer gets the frames it shows pulled
// out with ffmpeg into numbered JPEGs, once per film frame of source time, so a
// render, a check or a still is frame-exact and never waits on a video decoder.
// The frames are cached in out/<film>/frames/ and reused while nothing changes.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Timeline } from '../film/types.ts';
import { cropOf, sourceTime } from '../primitives/el/video.ts';
import type { FrameSequence } from '../primitives/types.ts';
import { filmName } from './files.ts';

/** What one layer needs pulled: a stretch of source, at a rate, at a width. */
export interface FootageNeed {
  key: string;
  src: string;
  /** Source seconds of the first frame, and how long a stretch. */
  start: number;
  length: number;
  /** Frames per source second. */
  rate: number;
  /** Width of the pulled frames in px; the height follows the shot. */
  width: number;
}

const isUrl = (s: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s);

/** The footage every el/video layer shows, worked out from the timeline alone. */
export function footageNeeds(t: Timeline, filmDir: string, scale = 1): FootageNeed[] {
  const needs: FootageNeed[] = [];
  const frame = 1 / t.fps;
  for (const s of t.scenes) {
    for (const l of s.layers) {
      if (l.use !== 'el/video') continue;
      const src = String(l.props.src);
      const rate = typeof l.params.rate === 'number' ? l.params.rate : 1;
      const from = typeof l.props.from === 'number' ? l.props.from : 0, to = typeof l.props.to === 'number' ? l.props.to : 0;
      // On screen from its start to its exit's end, or to the scene's last frame.
      const visible = Math.min(s.length, l.exit ? l.exit.start + l.exit.duration : s.length) - l.start;
      const looped = l.params.loop === true && to > from;
      const end = looped ? to : sourceTime(Math.max(0, visible - frame), l.props, l.params) + frame * rate;
      const [, , cw] = cropOf(l.props.crop);
      const width = Math.max(16, Math.ceil(((typeof l.params.width === 'number' ? l.params.width : 1280) * scale * 100) / cw / 2) * 2);
      needs.push({
        key: `${s.id}/${l.id}`, src: isUrl(src) ? src : path.resolve(filmDir, src),
        start: from, length: Math.max(frame * rate, end - from), rate: t.fps * rate, width,
      });
    }
  }
  return needs;
}

/** Width and height of a JPEG, read from its frame header. */
export function jpegSize(buf: Buffer): [number, number] | undefined {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return undefined;
}

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let err = '';
    const p = spawn('ffmpeg', args);
    p.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    p.on('error', (e) => reject(new Error(`el/video needs ffmpeg to draw footage frame by frame (${e.message}). Install it, e.g. brew install ffmpeg or apt install ffmpeg.`)));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg could not read the footage:\n${err.trim()}`))));
  });
}

/**
 * Pulls the frames for every el/video layer, reusing what is cached, and
 * returns them by "<scene>/<layer>" with URLs the preview server answers.
 */
export async function prepareFrames(filmFile: string, t: Timeline, scale = 1, log: (s: string) => void = () => {}): Promise<Record<string, FrameSequence>> {
  const filmDir = path.dirname(path.resolve(filmFile));
  const needs = footageNeeds(t, filmDir, scale);
  const out: Record<string, FrameSequence> = {};
  for (const n of needs) {
    let stamp = n.src;
    if (!isUrl(n.src)) {
      if (!fs.existsSync(n.src)) throw new Error(`Video not found: ${path.relative(process.cwd(), n.src)} (layer ${n.key}).`);
      const st = fs.statSync(n.src);
      stamp += `:${st.size}:${st.mtimeMs}`;
    }
    const hash = createHash('sha1').update(JSON.stringify([stamp, n.start, n.length, n.rate, n.width])).digest('hex').slice(0, 16);
    const dir = path.join(filmDir, 'out', filmName(filmFile), 'frames', hash);
    const marker = path.join(dir, 'frames.json');
    if (!fs.existsSync(marker)) {
      log(`Pulling ${n.key}: ${n.length.toFixed(2)} s of ${path.basename(n.src)} from ${n.start.toFixed(2)} s`);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      await run(['-v', 'error', '-y', '-ss', n.start.toFixed(6), '-i', n.src, '-t', n.length.toFixed(6), '-an',
        '-vf', `fps=${n.rate},scale=w='min(${n.width},iw)':h=-2:flags=lanczos`, '-q:v', '2', path.join(dir, '%05d.jpg')]);
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort();
      if (!files.length) throw new Error(`No frames came out of ${path.basename(n.src)} between ${n.start} s and ${n.start + n.length} s (layer ${n.key}). Is "from" past the end of the footage?`);
      const size = jpegSize(fs.readFileSync(path.join(dir, files[0]!))) ?? [16, 9];
      fs.writeFileSync(marker, JSON.stringify({ count: files.length, width: size[0], height: size[1] }));
    }
    const info = JSON.parse(fs.readFileSync(marker, 'utf8')) as { count: number; width: number; height: number };
    out[n.key] = {
      base: `/${path.relative(filmDir, dir).split(path.sep).map(encodeURIComponent).join('/')}/`, ext: 'jpg',
      count: info.count, start: n.start, rate: n.rate, width: info.width, height: info.height,
    };
  }
  return out;
}
