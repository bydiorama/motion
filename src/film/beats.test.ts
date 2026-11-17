import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyseBeats, loopWindows, offDownbeat } from './beats.ts';

const RATE = 22050;

/**
 * A click track: a short tick on every beat, a low thump on each downbeat, and under each
 * bar a tone that cycles through `cycle` pitches, so passages repeat every `cycle` bars.
 */
function clicks(bpm: number, offset: number, seconds: number, cycle = 4): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE)), beat = 60 / bpm;
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let n = 0; offset + n * beat < seconds; n++) {
    const t0 = Math.round((offset + n * beat) * RATE), down = n % 4 === 0;
    for (let i = 0; i < 0.03 * RATE && t0 + i < out.length; i++) out[t0 + i]! += noise() * 0.5 * Math.exp(-i / (0.008 * RATE));
    if (down) for (let i = 0; i < 0.12 * RATE && t0 + i < out.length; i++) out[t0 + i]! += Math.sin((2 * Math.PI * 55 * i) / RATE) * 0.8 * Math.exp(-i / (0.04 * RATE));
  }
  const tones = [220, 277, 330, 392, 440, 523];
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE, barIndex = Math.floor((t - offset) / (beat * 4));
    if (t < offset) continue;
    out[i]! += 0.15 * Math.sin(2 * Math.PI * tones[((barIndex % cycle) + cycle) % cycle]! * t);
  }
  return out;
}

test('the tempo and the downbeat of a steady pulse are found to the hundredth of a bpm', () => {
  const a = analyseBeats(clicks(101.41, 0.37, 40), RATE);
  assert.ok(Math.abs(a.bpm - 101.41) < 0.05, String(a.bpm));
  assert.ok(Math.abs(a.downbeat - 0.37) < 0.006, String(a.downbeat));
  assert.ok(a.confidence > 0.3, String(a.confidence));
  assert.ok(Math.abs(offDownbeat(a, 0.37 + 8 * 4 * 60 / 101.41)) < 0.02);
  // A fast pulse is not read at half speed.
  const b = analyseBeats(clicks(150, 0.1, 30), RATE);
  assert.ok(Math.abs(b.bpm - 150) < 0.1, String(b.bpm));
});

test('loop windows that span whole cycles of the music match across their seam', () => {
  const s = clicks(120, 0.25, 60, 4), a = analyseBeats(s, RATE);
  const whole = loopWindows(s, RATE, a, 8), off = loopWindows(s, RATE, a, 3);
  assert.ok(whole[0]!.match > 0.95, String(whole[0]!.match));
  assert.ok(whole[0]!.match > off[0]!.match + 0.05, `${whole[0]!.match} vs ${off[0]!.match}`);
  assert.ok(Math.abs(whole[0]!.to - whole[0]!.from - 16) < 0.01);
});
