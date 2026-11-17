import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveEase } from '../../core/ease.ts';
import { panGeometry, panSpeed, peakSlope } from './pan-across.ts';

test('a wide picture fills a tall frame top to bottom and runs past it sideways', () => {
  const g = panGeometry([1080, 1920], 16 / 9);
  assert.equal(g.axis, 'x');
  assert.equal(g.h, 1920);
  assert.ok(Math.abs(g.w - 3413.33) < 0.01);
  assert.ok(Math.abs(g.spare - 2333.33) < 0.01);
  // A tall picture in a wide frame runs down instead.
  assert.equal(panGeometry([1920, 1080], 0.5).axis, 'y');
});

test('the fastest speed counts the curve: a sine is π/2 times its average', () => {
  assert.ok(Math.abs(peakSlope((x) => x) - 1) < 1e-9);
  assert.ok(Math.abs(peakSlope(resolveEase('sine.inOut')) - Math.PI / 2) < 0.01);
  const g = panGeometry([1080, 1920], 16 / 9);
  const v = panSpeed(g, 20, 80, 2.4, resolveEase('sine.inOut'));
  // 60% of 2333 px in 2.4 s is 583 px/s on average, 916 px/s at its fastest.
  assert.ok(Math.abs(v - 916) < 5, String(v));
});
