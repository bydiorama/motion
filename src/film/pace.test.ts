import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pace } from './pace.ts';
import { resolveFilm } from './resolve.ts';
import { beatsToSeconds, offGrid, wholeFrameTempos } from './tempo.ts';
import type { Film } from './types.ts';

const film = (scenes: unknown, extra: object = {}): Film => ({ motion: '0.5', size: [1080, 1920], fps: 60, scenes, ...extra }) as Film;
const strips = (extra: object = {}) => ({
  id: 'grid', use: 'scene/strip-cycle', props: { images: ['a.png', 'b.png', 'c.png'] }, params: { hold: '4b', shift: '2b', ...extra },
});
const codesOf = (f: Film) => {
  const r = resolveFilm(f);
  assert.ok(r.timeline, JSON.stringify(r.issues));
  return pace(r.timeline).issues.map((i) => i.code);
};

test('beats and bars turn into seconds at the film tempo', () => {
  const t = { bpm: 120, bar: 4 };
  assert.equal(beatsToSeconds('2b', t), 1);
  assert.equal(beatsToSeconds('1 bar', t), 2);
  assert.equal(beatsToSeconds('0.5 beats', t), 0.25);
  assert.equal(beatsToSeconds('2s', t), undefined);
  assert.ok(offGrid(2.01, 0.5) < 0.011 && offGrid(2.25, 0.5) === 0.25);
  // At 60 fps, 120 and 100 bpm fall on whole frames; 128 does not, so it is never offered.
  assert.ok(wholeFrameTempos(128, 60).every((b) => Number.isInteger((60 * 60) / b)));
});

test('a film with a tempo can write any time in beats; without one, beats are an error', () => {
  const r = resolveFilm(film([
    { id: 'a', length: '4bars', layers: [{ id: 'dot', use: 'el/box', at: '1b', tracks: { y: [['0b', 0], ['1b', -40]] }, enter: { move: 'fade', duration: '0.5b' } }], out: { use: 'transition/blur-dissolve', duration: '1b' } },
    { id: 'b', layers: [{ id: 't', use: 'el/text', props: { text: 'x' }, at: 'scene.start + 2b' }], hold: '2b' },
  ], { tempo: { bpm: 120 } }));
  assert.ok(r.ok, JSON.stringify(r.issues));
  const [a, b] = r.timeline!.scenes;
  assert.equal(a!.length, 8);
  assert.equal(a!.layers[0]!.start, 0.5);
  assert.equal(a!.layers[0]!.enter!.duration, 0.25);
  assert.deepEqual(a!.layers[0]!.source.tracks!.y, [[0, 0], [0.5, -40]]);
  assert.equal(a!.out!.duration, 0.5);
  assert.equal(b!.layers[0]!.start, 1);
  assert.equal(r.timeline!.tempo!.bpm, 120);

  const none = resolveFilm(film([{ id: 'a', length: '4b', layers: [] }]));
  assert.deepEqual(none.issues.map((i) => i.code), ['needs-tempo']);
});

test('a beat that falls between frames is reported with tempos that do not', () => {
  const r = resolveFilm(film([{ id: 'a', length: 2, layers: [] }], { tempo: { bpm: 128 } }));
  const w = r.issues.find((i) => i.code === 'beat-off-frame');
  assert.ok(w?.hint?.includes('120'));
});

test('params that are times take beats; others refuse them', () => {
  const r = resolveFilm(film([{ id: 'a', layers: [strips({ rows: '2b' })] }], { tempo: { bpm: 120 } }));
  assert.ok(r.issues.some((i) => i.code === 'bad-param' && i.path.endsWith('rows')));
  const ok = resolveFilm(film([{ id: 'a', layers: [strips()] }], { tempo: { bpm: 120 } }));
  assert.equal(ok.timeline!.scenes[0]!.layers[0]!.params.shift, 1);
  assert.deepEqual(ok.timeline!.scenes[0]!.layers[0]!.cues, [{ at: 2, length: 1 }, { at: 5, length: 1 }]);
});

test('a hand-over that outweighs the scenes it joins is reported', () => {
  const codes = codesOf(film([
    { id: 'a', length: 3, layers: [], out: { use: 'transition/blur-dissolve', duration: 0.8 } },
    { id: 'b', length: 2, layers: [], out: { use: 'transition/blur-dissolve', duration: 0.8 } },
    { id: 'c', length: 3, layers: [] },
  ]));
  assert.ok(codes.includes('handover-long'));
  assert.ok(codes.includes('handover-crowds'));
});

test('a hand-over as long as a picture is felt as one more picture', () => {
  const codes = codesOf(film([
    { id: 'a', layers: [strips({ hold: 1.2, shift: 0.8 })], out: { use: 'transition/band-sweep', duration: 1.2 } },
    { id: 'b', layers: [strips({ hold: 1.2, shift: 0.8 })] },
  ]));
  assert.ok(codes.includes('handover-vs-picture'));
});

test('changes of different lengths, and scenes of different busyness, are reported', () => {
  const codes = codesOf(film([
    { id: 'a', layers: [strips({ hold: 1.2, shift: 0.4 })], out: { use: 'transition/blur-dissolve', duration: 0.4 } },
    { id: 'b', layers: [strips({ hold: 5, shift: 1.2 })] },
  ]));
  assert.ok(codes.includes('uneven-changes'));
  assert.ok(codes.includes('uneven-rests'));
  assert.ok(codes.includes('uneven-density'));
});

test('on a tempo, cuts land on bars and moves on the half-beat', () => {
  const on = codesOf(film([
    { id: 'a', length: '4bars', layers: [strips()], out: { use: 'transition/blur-dissolve', duration: '1b' } },
    { id: 'b', length: '4bars', layers: [strips()] },
  ], { tempo: { bpm: 120 }, loop: true }));
  // a's cut sits half a hand-over after b starts: 8 - 0.5 + 0.25 is not a bar line.
  assert.ok(on.includes('off-grid'));
  assert.ok(on.includes('loop-bars'));

  const clean = codesOf(film([
    { id: 'a', length: '4.125bars', layers: [strips()], out: { use: 'transition/blur-dissolve', duration: '1b' } },
    { id: 'b', length: '4.125bars', layers: [strips({ shift: 0.33 })] },
  ], { tempo: { bpm: 120 }, loop: true }));
  assert.ok(!clean.includes('off-grid'), clean.join());
  assert.ok(!clean.includes('loop-bars'), clean.join());
  assert.ok(clean.includes('off-beat'));
});

const wall = (extra: object = {}) => ({
  id: 'wall', use: 'scene/bento-grid',
  props: { areas: 'a b / c d', items: ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png'], counts: [2, 2, 2, 2] },
  params: { hold: '2.5b', swap_time: '1.5b', offset: '0.5b', stagger: 0, ...extra },
});

test('changes after a scene is cut away do not count, and a cycling wall may end on a rest', () => {
  // The wall runs two rounds (9.6 s) but the scene cuts it after one, on a rest.
  const r = resolveFilm(film([
    { id: 'a', length: '4.75b', layers: [wall()], out: { use: 'transition/blur-dissolve', duration: '1.5b' } },
    { id: 'b', length: '4bars', layers: [] },
  ], { tempo: { bpm: 100 } }));
  assert.ok(r.timeline, JSON.stringify(r.issues));
  assert.ok(!r.issues.some((i) => i.code === 'cut-off' || i.code === 'cut-mid-change'), JSON.stringify(r.issues));
  const p = pace(r.timeline!);
  // Four tiles swap once before the cut; the second round is never seen.
  assert.equal(p.scenes.find((s) => s.id === 'a')!.changes, 4);

  const mid = resolveFilm(film([{ id: 'a', length: '3.5b', layers: [wall()] }], { tempo: { bpm: 100 } }));
  assert.ok(mid.issues.some((i) => i.code === 'cut-mid-change'), JSON.stringify(mid.issues));
});

test('a wall that swaps a tile at a time is no busier than a scene of whole pictures', () => {
  // Six tiles, one swapping every two beats: a sixth of the frame at a time.
  const tiles = { id: 'wall', use: 'scene/bento-grid', props: { areas: 'a b / c d / e f', items: Array.from({ length: 12 }, (_, i) => `${i}.png`), counts: [2, 2, 2, 2, 2, 2] }, params: { width: 100, gap: 0, hold: '10.5b', swap_time: '1.5b', offset: '2b', stagger: 0 } };
  const r = resolveFilm(film([
    { id: 'a', length: '3bars', layers: [tiles], out: { use: 'transition/blur-dissolve', duration: '1b' } },
    { id: 'b', length: '3bars', layers: [strips({ hold: '2.5b', shift: '1.5b' })] },
  ], { tempo: { bpm: 100 } }));
  const p = pace(r.timeline!);
  const wall = p.scenes.find((s) => s.id === 'a')!;
  assert.ok(Math.abs(wall.rate - (wall.changes / 6) / wall.length) < 1e-3, JSON.stringify(wall));
  assert.ok(!p.issues.some((i) => i.code === 'uneven-density'), JSON.stringify(p.issues));
});
