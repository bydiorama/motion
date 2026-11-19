import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guardFindings, type GuardSample } from './guard.ts';

const frame = (o: Partial<GuardSample> = {}): GuardSample => ({ shifts: [], sizes: [], zooms: [['html', 1]], scaled: 1, ...o });

test('guard: a page that moves by transforms only is clean', () => {
  const frames = Array.from({ length: 30 }, () => frame({ sizes: [[1, 'p "Hello"', 400, 60, 20, 40]] }));
  assert.deepEqual(guardFindings(frames, 60), []);
});

test('guard: layout moves, re-wraps, CSS zoom and scaled stages are named', () => {
  const frames = Array.from({ length: 30 }, (_, i) => frame({
    // A glide by top; a line that re-wraps and back; zoom that breathes; a 2.4× stage.
    sizes: [[1, 'div#card', 500, 140, 40, 40 + Math.floor(i / 2)], [2, 'p#line', 500, i >= 10 && i < 13 ? 96 : 64, 60, 300]],
    zooms: [['html', 1], ['div#stage', i < 20 ? 1 : 1 + (i - 20) * 0.01]],
    scaled: 2.4,
  }));
  const f = guardFindings(frames, 60).join('\n');
  assert.match(f, /div#card moved in layout on \d+ frame/);
  assert.match(f, /p#line changed size 500×64 → 500×96 → 500×64/);
  assert.match(f, /CSS zoom on div#stage changes/);
  assert.match(f, /scaled 2\.4×/);
});
