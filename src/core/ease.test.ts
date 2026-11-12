import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bezier, EASE_NAMES, progress, resolveEase, rng } from './ease.ts';
import { track } from './track.ts';

test('every named ease starts at 0 and ends at 1', () => {
  for (const name of EASE_NAMES) {
    const e = resolveEase(name);
    assert.ok(Math.abs(e(0)) < 1e-6, `${name}(0)`);
    assert.ok(Math.abs(e(1) - 1) < 1e-6, `${name}(1)`);
  }
});

test('bezier matches known CSS values', () => {
  const ease = bezier(0.25, 0.1, 0.25, 1); // CSS "ease"
  assert.ok(Math.abs(ease(0.5) - 0.8024) < 1e-3);
  assert.equal(bezier(0, 0, 1, 1)(0.3).toFixed(4), '0.3000');
});

test('a theme can replace the ui curves', () => {
  const themed = resolveEase('ui.out', { 'ui.out': [0, 0, 1, 1] });
  assert.ok(Math.abs(themed(0.4) - 0.4) < 1e-6);
});

test('an unknown ease names the known ones', () => {
  assert.throws(() => resolveEase('bouncy'), /Unknown ease "bouncy"/);
});

test('progress clamps and handles zero duration', () => {
  const lin = resolveEase('linear');
  assert.equal(progress(0.5, 1, 1, lin), 0);
  assert.equal(progress(1.5, 1, 1, lin), 0.5);
  assert.equal(progress(9, 1, 1, lin), 1);
  assert.equal(progress(1, 1, 0, lin), 1);
});

test('rng repeats for a seed and differs between seeds', () => {
  const a = rng(7), b = rng(7), c = rng(8);
  const xs = [a(), a(), a()], ys = [b(), b(), b()];
  assert.deepEqual(xs, ys);
  assert.notEqual(xs[0], c());
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('a track holds before its first key and after its last, and eases into each key', () => {
  const t = track([[1, 10], [2, 20, 'linear'], [3, 0, 'linear']]);
  assert.equal(t(0), 10);
  assert.equal(t(1.5), 15);
  assert.equal(t(2.5), 10);
  assert.equal(t(99), 0);
});
