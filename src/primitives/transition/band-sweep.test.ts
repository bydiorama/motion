import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bandAngles, bandAt, coverThickness } from './band-sweep.ts';

const linear = (x: number) => x;

test('every band is across and fully grown at the cut', () => {
  for (let i = 0; i < 5; i++) assert.deepEqual(bandAt(0.5, i, 5, 0.05, linear), { lead: 1, trail: 0, swell: 1 });
});

test('bands enter one after another and have all left by the end', () => {
  const a = bandAt(0.1, 0, 5, 0.05, linear), b = bandAt(0.1, 3, 5, 0.05, linear);
  assert.ok(a.lead > b.lead);
  for (let i = 0; i < 5; i++) assert.equal(bandAt(1, i, 5, 0.05, linear).trail, 1);
  for (let i = 0; i < 5; i++) assert.equal(bandAt(0, i, 5, 0.05, linear).lead, 0);
});

test('tilts alternate sides and stay within the angle', () => {
  const a = bandAngles(5, 14);
  a.forEach((v, i) => { assert.ok(Math.abs(v) <= 14); assert.equal(Math.sign(v), i % 2 === 0 ? 1 : -1); });
});

test('grown bands overlap their neighbours even at full tilt', () => {
  // Five bands over 1920 px are 384 px apart; tilted 14° each way over 1080 px their gap opens by up to ~280 px.
  const t = coverThickness(5, 1920, 1080, 14);
  assert.ok(t > 384 + Math.tan((28 * Math.PI) / 180) * 540);
});

test('flat bands are exactly their share of the frame, so they lie on a grid of rows', () => {
  // Four flat bands over a 1920 px frame: each two rows of an 8-row grid, plus a pixel against seams.
  assert.equal(coverThickness(4, 1920, 1080, 0), 481);
});
