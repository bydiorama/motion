import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveFilm } from '../film/resolve.ts';
import { film, grid, layer, repeat, scene, sequence, staggerFrom } from './index.ts';

test('a built film is plain film JSON that resolves', () => {
  const f = film({ size: [1280, 720], scenes: [scene('a', [repeat(3, (i) => layer(`t${i}`, 'el/text', { props: { text: String(i) } }))])] });
  assert.equal(typeof f.motion, 'string');
  assert.deepEqual(f.scenes[0]!.layers.map((l) => l.id), ['t0', 't1', 't2']);
  assert.ok(resolveFilm(f).ok);
});

test('grid centres items in their cells', () => {
  assert.deepEqual(grid(4, 2, { x: [0, 100], y: [0, 100] }), [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 25, y: 75 }, { x: 75, y: 75 }]);
});

test('staggerFrom starts the nearest placed layers first, equal distances together', () => {
  const ls = grid(3, 3, { x: [0, 90], y: [50, 50] }).map((place, i) => layer(`c${i}`, 'el/box', { place }));
  const timed = staggerFrom([...ls, layer('free', 'el/text', { at: 2 })], { focus: [45, 50], step: 0.1, start: 1 });
  assert.deepEqual(timed.map((l) => l.at), [1.1, 1, 1.1, 2]);
});

test('sequence chains layers end to start', () => {
  const s = sequence([layer('a', 'el/text'), layer('b', 'el/text'), layer('c', 'el/text')], 0.2);
  assert.deepEqual(s.map((l) => l.at), [0, 'a.end + 0.2', 'b.end + 0.2']);
});

test('staggerFrom reads layers placed in px against the artboard they sit on', () => {
  const at = (x: number, y: number, id: string) => layer(id, 'el/box', { place: { x, y, unit: 'px' as const } });
  const timed = staggerFrom([at(1800, 540, 'far'), at(100, 540, 'near')], { focus: [0, 50], step: 0.5, artboard: { width: 1920, height: 1080 } });
  assert.equal(timed.find((l) => l.id === 'near')!.at, 0);
  assert.ok(Number(timed.find((l) => l.id === 'far')!.at) > 0);
  assert.throws(() => staggerFrom([at(1, 1, 'x')], { focus: [0, 0], step: 1 }), /artboard/);
});
