// Tempo: one pulse for the whole film. With a tempo set, any time in a film can
// be written in beats or bars ("2b", "1bar", "headline.end + 1b") and the pace
// check measures every cut and change against the grid. Change the bpm and the
// whole film follows, in proportion.

export interface Tempo {
  /** Beats per minute. */
  bpm: number;
  /** Beats in a bar. */
  bar: number;
}

/** A length in beats or bars: `2b`, `0.5 beat`, `1bar`, `2 bars`. */
export const BEAT_UNIT = /^\s*(\d+(?:\.\d+)?)\s*(b|beats?|bars?)\s*$/;

export const isBeats = (v: unknown): v is string => typeof v === 'string' && BEAT_UNIT.test(v);

/** Seconds in one beat. */
export const beatLength = (t: Tempo): number => 60 / t.bpm;

/** Seconds for `2b`, `1bar` and the like; undefined when the text is not a beat length. */
export function beatsToSeconds(v: string, tempo: Tempo): number | undefined {
  const m = BEAT_UNIT.exec(v);
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2]!.startsWith('bar') ? n * tempo.bar * beatLength(tempo) : n * beatLength(tempo);
}

/** Frames in one beat at this frame rate; whole when the beat falls on a frame. */
export const framesPerBeat = (t: Tempo, fps: number): number => (fps * 60) / t.bpm;

/** Tempos near `bpm` whose beat is a whole number of frames, nearest first. */
export function wholeFrameTempos(bpm: number, fps: number, count = 3): number[] {
  const out: number[] = [];
  for (let frames = 1; frames <= fps * 2; frames++) {
    const b = (fps * 60) / frames;
    if (b >= 40 && b <= 240 && Number.isInteger(Math.round(b * 1000) / 1000)) out.push(Math.round(b * 1000) / 1000);
  }
  return out.sort((a, b) => Math.abs(a - bpm) - Math.abs(b - bpm)).slice(0, count);
}

/** Where t sits on the grid of `step` seconds: distance to the nearest line, in seconds. */
export const offGrid = (t: number, step: number): number => {
  const r = ((t % step) + step) % step;
  return Math.min(r, step - r);
};
