// A soundtrack's pulse, measured: its tempo, where its bars start, and the stretches of
// it that loop. Pure: it takes mono samples, so the CLI decodes the file and the tests
// feed it a click track. It assumes one steady tempo, as produced music has.

export interface BeatAnalysis {
  /** Beats a minute, to two decimals. */
  bpm: number;
  /** Seconds a beat. */
  beat: number;
  /** Beats in a bar, as asked for. */
  bar: number;
  /** The first downbeat, seconds into the file. */
  downbeat: number;
  /** Every downbeat in the file, seconds. */
  downbeats: number[];
  /** How clearly the beat stands out, 0 to 1: under about 0.3, check by ear. */
  confidence: number;
  /** Seconds of audio analysed. */
  duration: number;
}

export interface LoopWindow {
  /** Seconds into the file: set this as `audio.from`. */
  from: number;
  to: number;
  bars: number;
  /** How alike the music is across the seam, 0 to 1: the bar before `to` against the bar before `from`, and the bar after each. */
  match: number;
}

const HOP = 256, SIZE = 1024;

/** In-place radix-2 FFT of re/im, length a power of two. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j]!, re[i]!]; [im[i], im[j]] = [im[j]!, im[i]!]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2;
        const tr = re[q]! * cr - im[q]! * ci, ti = re[q]! * ci + im[q]! * cr;
        re[q] = re[p]! - tr; im[q] = im[p]! - ti;
        re[p] = re[p]! + tr; im[p] = im[p]! + ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

interface Spectra {
  /** Frames a second. */
  rate: number;
  /**
   * Seconds from the start of the file to frame 0's moment: the middle of its window, plus
   * one hop, since a rise is measured against the frame before. On clicks of known time,
   * this puts the beat within a few ms of the attack.
   */
  lead: number;
  /** Onset strength per frame: how much louder the spectrum got, all bands and the lows alone. */
  onset: Float64Array;
  low: Float64Array;
  /** A coarse log spectrum per frame, for comparing passages. */
  bands: Float64Array[];
}

const BANDS = 16;

export function spectra(samples: Float32Array, sampleRate: number): Spectra {
  const frames = Math.max(0, Math.floor((samples.length - SIZE) / HOP) + 1);
  const win = new Float64Array(SIZE).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / SIZE));
  const half = SIZE / 2, lowBin = Math.max(2, Math.round((200 * SIZE) / sampleRate));
  // Band edges spaced evenly in log frequency from 60 Hz to the top.
  const edges = Array.from({ length: BANDS + 1 }, (_, b) => Math.min(half, Math.max(1, Math.round(((60 * Math.pow(sampleRate / 2 / 60, b / BANDS)) * SIZE) / sampleRate))));
  const onset = new Float64Array(frames), low = new Float64Array(frames), bands: Float64Array[] = [];
  let prev = new Float64Array(half);
  const re = new Float64Array(SIZE), im = new Float64Array(SIZE);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < SIZE; i++) { re[i] = samples[f * HOP + i]! * win[i]!; im[i] = 0; }
    fft(re, im);
    const mag = new Float64Array(half);
    let flux = 0, lflux = 0;
    for (let k = 1; k < half; k++) {
      mag[k] = Math.log1p(100 * Math.hypot(re[k]!, im[k]!));
      const d = mag[k]! - prev[k]!;
      if (d > 0) { flux += d; if (k <= lowBin) lflux += d; }
    }
    onset[f] = flux; low[f] = lflux;
    const b = new Float64Array(BANDS);
    for (let j = 0; j < BANDS; j++) {
      const a = edges[j]!, z = Math.max(a + 1, edges[j + 1]!);
      let sum = 0;
      for (let k = a; k < z; k++) sum += mag[k]!;
      b[j] = sum / (z - a);
    }
    bands.push(b);
    prev = mag;
  }
  // Keep only what rises above the local level, so a loud passage does not outweigh the pulse.
  const detrend = (x: Float64Array) => {
    const out = new Float64Array(x.length), r = 16;
    for (let i = 0; i < x.length; i++) {
      let s = 0, n = 0;
      for (let j = Math.max(0, i - r); j <= Math.min(x.length - 1, i + r); j++) { s += x[j]!; n++; }
      out[i] = Math.max(0, x[i]! - s / n);
    }
    return out;
  };
  return { rate: sampleRate / HOP, lead: (SIZE / 2 + HOP) / sampleRate, onset: detrend(onset), low: detrend(low), bands };
}

/** The value of x at a fractional index, linearly between frames. */
const at = (x: Float64Array, i: number) => {
  const a = Math.floor(i), k = i - a;
  return a < 0 || a + 1 >= x.length ? 0 : x[a]! * (1 - k) + x[a + 1]! * k;
};

/** How strongly the onsets line up on a grid of `period` frames: the best phase, and its score. */
export function comb(x: Float64Array, period: number, steps = 48): { phase: number; score: number } {
  let best = { phase: 0, score: -Infinity };
  for (let s = 0; s < steps; s++) {
    const phase = (s / steps) * period;
    let sum = 0, n = 0;
    for (let i = phase; i < x.length; i += period) { sum += at(x, i); n++; }
    const score = n ? sum / n : 0;
    if (score > best.score) best = { phase, score };
  }
  // Refine the phase between steps.
  const step = period / steps;
  for (let d = -step; d <= step; d += step / 8) {
    const phase = best.phase + d;
    let sum = 0, n = 0;
    for (let i = phase; i < x.length; i += period) { sum += at(x, i); n++; }
    const score = n ? sum / n : 0;
    if (score > best.score) best = { phase, score };
  }
  return best;
}

/**
 * The tempo and bar grid of a mono signal. `range` bounds the tempo in bpm; the middle of
 * a wide range is preferred when the pulse could be read at half or double speed.
 */
export function analyseBeats(samples: Float32Array, sampleRate: number, o: { bar?: number; range?: [number, number] } = {}): BeatAnalysis {
  const bar = o.bar ?? 4, [lo, hi] = o.range ?? [70, 180];
  const sp = spectra(samples, sampleRate), x = sp.onset, fps = sp.rate;
  const mean = x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
  // Autocorrelation over the lags of the tempo range, weighted towards 120 bpm on a log scale.
  const lag = (bpm: number) => (60 * fps) / bpm;
  let coarse = 120, bestAc = -Infinity, acZero = 0;
  for (let i = 0; i < x.length; i++) acZero += (x[i]! - mean) ** 2;
  for (let bpm = lo; bpm <= hi; bpm += 0.5) {
    const L = lag(bpm);
    let s = 0;
    for (let i = 0; i + L + 1 < x.length; i++) s += (x[i]! - mean) * (at(x, i + L) - mean);
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    if (s * prior > bestAc) { bestAc = s * prior; coarse = bpm; }
  }
  // Refine: the period whose grid the onsets fall on most squarely, across the whole file.
  // The peak is narrow (a tenth of a bpm over a minute of music), so scan densely, and widely
  // enough to undo the prior's pull on the coarse guess.
  let bpm = coarse, best = comb(x, lag(coarse));
  for (const [width, step] of [[coarse * 0.04, 0.02], [0.03, 0.002]] as const) {
    const centre = bpm;
    for (let i = -Math.round(width / step); i <= Math.round(width / step); i++) {
      const b = centre + i * step, c = comb(x, lag(b));
      if (c.score > best.score) { best = c; bpm = b; }
    }
  }
  const period = lag(bpm);
  // Downbeats: of the bar's beats, the one where the harmony changes most (chords turn on
  // the bar), helped by where the low end hits hardest (a kick on 1, though often on 3 too).
  const beats: number[] = [];
  for (let i = best.phase; i + period < x.length; i += period) beats.push(i);
  const colour = beats.map((i) => {
    const v = new Float64Array(BANDS), a = Math.round(i), z = Math.max(a + 1, Math.round(i + period));
    for (let f = a; f < z; f++) { const row = sp.bands[f]; if (row) for (let j = 0; j < BANDS; j++) v[j] = v[j]! + row[j]! / (z - a); }
    return v;
  });
  const mix = (from: number, n: number) => {
    const v = new Float64Array(BANDS);
    for (let b = from; b < from + n; b++) for (let j = 0; j < BANDS; j++) v[j] = v[j]! + colour[b]![j]! / n;
    return v;
  };
  const novelty = beats.map((_, b) => {
    if (b < 2 || b + 2 > beats.length) return 0;
    const p = mix(b - 2, 2), q = mix(b, 2);
    let d = 0;
    for (let j = 0; j < BANDS; j++) d += (p[j]! - q[j]!) ** 2;
    return Math.sqrt(d);
  });
  const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
  const nMean = avg(novelty) || 1, lMean = avg(beats.map((i) => at(sp.low, i))) || 1;
  let down = 0, downScore = -Infinity;
  for (let k = 0; k < bar; k++) {
    const nov: number[] = [], low: number[] = [];
    for (let b = k; b < beats.length; b += bar) { nov.push(novelty[b]!); low.push(at(sp.low, beats[b]!)); }
    const score = avg(nov) / nMean + 0.5 * (avg(low) / lMean);
    if (nov.length && score > downScore) { downScore = score; down = k; }
  }
  const first = (((best.phase + down * period) % (period * bar)) / fps + sp.lead) % ((period * bar) / fps);
  const duration = samples.length / sampleRate, beat = 60 / bpm;
  const downbeats: number[] = [];
  for (let t = first; t < duration; t += beat * bar) downbeats.push(round(t, 3));
  const confidence = mean > 0 ? Math.max(0, Math.min(1, (best.score / mean - 1) / 3)) : 0;
  return { bpm: round(bpm, 2), beat: round(beat, 5), bar, downbeat: round(first, 3), downbeats, confidence: round(confidence, 2), duration: round(duration, 3) };
}

/**
 * Scores seams on one analysed file: how alike the music is either side of a cut from `to`
 * back to `from`. The bar before `to` should sound like the bar before `from`, and the bar
 * after `to` like the bar after `from`, beat by beat.
 */
export function seams(samples: Float32Array, sampleRate: number, a: BeatAnalysis): (from: number, to: number) => number | undefined {
  const sp = spectra(samples, sampleRate), fps = sp.rate, barLen = a.beat * a.bar;
  // The file's average colour is taken out, so what is compared is how passages differ, not
  // the timbre every passage shares.
  const avg = new Float64Array(BANDS);
  for (const row of sp.bands) for (let j = 0; j < BANDS; j++) avg[j] = avg[j]! + row[j]! / sp.bands.length;
  // One coarse spectrum per beat, so passages compare beat by beat.
  const perBeat = (t: number): Float64Array | undefined => {
    const f0 = Math.round((t - sp.lead) * fps), f1 = Math.round((t + a.beat - sp.lead) * fps);
    if (f0 < 0 || f1 > sp.bands.length) return undefined;
    const v = new Float64Array(BANDS);
    for (let f = f0; f < f1; f++) for (let j = 0; j < BANDS; j++) v[j] = v[j]! + (sp.bands[f]![j]! - avg[j]!) / (f1 - f0);
    return v;
  };
  const passage = (t: number) => {
    const out: number[] = [];
    for (let b = 0; b < a.bar; b++) { const v = perBeat(t + b * a.beat); if (!v) return undefined; out.push(...v); }
    return out;
  };
  // The correlation of two passages, beat for beat: 1 the same, 0 unrelated (or opposite).
  const alike = (p: number[], q: number[]) => {
    let pq = 0, pp = 0, qq = 0;
    for (let i = 0; i < p.length; i++) { pq += p[i]! * q[i]!; pp += p[i]! ** 2; qq += q[i]! ** 2; }
    return Math.max(0, pq / Math.sqrt(Math.max(1e-12, pp * qq)));
  };
  return (from, to) => {
    const b0 = passage(from - barLen), b1 = passage(to - barLen), a0 = passage(from), a1 = passage(to);
    if (!b0 || !b1 || !a0 || !a1) return undefined;
    return round((alike(b0, b1) + alike(a0, a1)) / 2, 3);
  };
}

/** Windows of `bars` bars, each starting on a downbeat, ranked by how seamlessly the music loops across them. */
export function loopWindows(samples: Float32Array, sampleRate: number, a: BeatAnalysis, bars: number, top = 5): LoopWindow[] {
  const seam = seams(samples, sampleRate, a), span = bars * a.beat * a.bar, out: LoopWindow[] = [];
  for (const from of a.downbeats) {
    const match = seam(from, from + span);
    if (match !== undefined) out.push({ from: round(from, 3), to: round(from + span, 3), bars, match });
  }
  return out.sort((p, q) => q.match - p.match).slice(0, top);
}

/** How far a time is from the nearest downbeat, in seconds (negative: before it). */
export function offDownbeat(a: BeatAnalysis, t: number): number {
  const barLen = a.beat * a.bar, k = Math.round((t - a.downbeat) / barLen);
  return round(t - (a.downbeat + k * barLen), 3);
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
