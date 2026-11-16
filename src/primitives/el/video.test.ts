import assert from 'node:assert/strict';
import { test } from 'node:test';
import { footageNeeds } from '../../cli/frames.ts';
import { resolveFilm } from '../../film/resolve.ts';
import type { Film } from '../../film/types.ts';
import { sourceTime, video } from './video.ts';

const film = (scenes: unknown): Film => ({ motion: '0.4', size: [1280, 720], fps: 30, scenes }) as Film;
const clip = (id: string, props: object, params: object = {}) => ({ id, use: 'el/video', props: { src: 'clip.mp4', ...props }, params });

test('source time runs at the rate, stops at "to", and wraps when it loops', () => {
  assert.equal(sourceTime(1, { from: 2 }, { rate: 1 }), 3);
  assert.equal(sourceTime(1, { from: 2, to: 2.5 }, { rate: 1 }), 2.5);
  assert.equal(sourceTime(1, { from: 2 }, { rate: 2 }), 4);
  assert.ok(Math.abs(sourceTime(1.25, { from: 2, to: 3 }, { rate: 1, loop: true }) - 2.25) < 1e-9);
});

test('a clip with both ends lasts its stretch at its rate; an open or looping one lasts the scene', () => {
  assert.equal(video.duration({ from: 1, to: 3 }, { rate: 2 }, {} as never), 1);
  assert.equal(video.duration({ from: 1, to: 0 }, { rate: 1 }, {} as never), 0);
  assert.equal(video.duration({ from: 1, to: 3 }, { rate: 1, loop: true }, {} as never), 0);
});

test('impossible ends, loops and crops are reported on the layer', () => {
  const r = resolveFilm(film([{ id: 'a', length: 2, layers: [
    clip('back', { from: 3, to: 2 }),
    clip('loop', { from: 1 }, { loop: true }),
    clip('crop', { crop: [60, 0, 50, 50] }),
  ] }]));
  const paths = r.issues.filter((i) => i.level === 'error').map((i) => i.path);
  assert.deepEqual(paths, ['scenes.a.layers.back.props.to', 'scenes.a.layers.loop.params.loop', 'scenes.a.layers.crop.props.crop']);
});

test('"continues" opens on the frame after the other layer\'s last one, so a loop has no seam', () => {
  const r = resolveFilm(film([
    { id: 'intro', length: 2, layers: [clip('shot', { continues: 'outro.shot' })] },
    { id: 'outro', length: 2, layers: [clip('shot', { from: 5 }, { rate: 1.5 })] },
  ]));
  assert.ok(r.ok, JSON.stringify(r.issues));
  // The outro's last frame is at 2 - 1/30 s, showing 5 + 1.9667 × 1.5; one frame later at that rate is 8.
  assert.equal(r.timeline!.scenes[0]!.layers[0]!.props.from, 8);
});

test('"continues" must name a video layer playing the same file', () => {
  const r = resolveFilm(film([
    { id: 'a', length: 1, layers: [clip('x', { continues: 'b.nope' }), clip('y', { continues: 'b.text' }), clip('z', { continues: 'b.other' })] },
    { id: 'b', length: 1, layers: [{ id: 'text', use: 'el/text', props: { text: 'hi' } }, { id: 'other', use: 'el/video', props: { src: 'other.mp4' } }] },
  ]));
  assert.deepEqual(r.issues.map((i) => i.code), ['unknown-layer', 'bad-value', 'bad-value']);
});

test('the CLI pulls only the stretch each layer shows, at film frames per source second', () => {
  const r = resolveFilm(film([{ id: 'a', length: 2, layers: [
    clip('open', { from: 4 }, { width: 640 }),
    clip('loop', { from: 1, to: 1.5, crop: [0, 0, 50, 50] }, { loop: true, rate: 0.5, width: 400 }),
  ] }]));
  const [open, loop] = footageNeeds(r.timeline!, '/films', 2);
  assert.deepEqual(open, { key: 'a/open', src: '/films/clip.mp4', start: 4, length: 2, rate: 30, width: 1280 });
  assert.deepEqual(loop, { key: 'a/loop', src: '/films/clip.mp4', start: 1, length: 0.5, rate: 15, width: 1600 });
});
