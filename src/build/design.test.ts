import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveFilm } from '../film/resolve.ts';
import { kindOf, readingOrder, sceneFromDesign, type Design } from './design.ts';

const slide: Design = {
  width: 1920, height: 1080, background: '#123456',
  layers: [
    { name: 'Rule 1', x: 0, y: 50, width: 1900, height: 2, fill: '#ffffff' },
    { name: 'Rule 2', x: 0, y: 292, width: 1900, height: 2, fill: '#ffffff' },
    { name: 'Rule 3', x: 0, y: 534, width: 1900, height: 2, fill: '#ffffff' },
    { name: 'Name', x: 115, y: 326, width: 846, height: 300, src: 'parts/name.png' },
    { name: 'Dates', x: 454, y: 102, width: 300, height: 60, src: 'parts/dates.png' },
    { name: 'Festival', x: 104, y: 103, width: 300, height: 60, src: 'parts/festival.png' },
    { name: 'Photo', x: 1103, y: 177, width: 816, height: 903, src: 'parts/photo.png' },
    { name: 'Name', x: 482, y: 556, width: 661, height: 300, src: 'parts/name-2.png' },
  ],
};

test('parts are read as rules, type and pictures by their shape', () => {
  const frame = { width: 1920, height: 1080 };
  assert.deepEqual(slide.layers.map((l) => kindOf(l, frame)), ['rule', 'rule', 'rule', 'type', 'type', 'type', 'picture', 'type']);
  assert.equal(kindOf({ ...slide.layers[6]!, kind: 'type' }, frame), 'type');
  // Reading order: rows from the top, each left to right.
  assert.deepEqual(readingOrder(slide.layers.slice(3, 6), 1080).map((l) => l.name), ['Festival', 'Dates', 'Name']);
});

test('a design becomes a scene on its artboard that builds in reading order, keeping the stack', () => {
  const s = sceneFromDesign('slide', slide, { step: '0.5b', fit: 'height' });
  assert.deepEqual(s.artboard, { width: 1920, height: 1080, fit: 'height' });
  assert.equal(s.background, '#123456');
  // The stack is the design's; names become unique ids.
  assert.deepEqual(s.layers.map((l) => l.id), ['rule-1', 'rule-2', 'rule-3', 'name', 'dates', 'festival', 'photo', 'name-2']);
  const by = Object.fromEntries(s.layers.map((l) => [l.id, l]));
  // Rules first, two at a time, drawing across; then type in reading order; the picture last.
  assert.deepEqual([by['rule-1']!.at, by['rule-2']!.at, by['rule-3']!.at], [undefined, undefined, '0.5b']);
  assert.deepEqual(by['rule-1']!.enter, { move: 'wipe', angle: 0, duration: '1.5b', ease: 'expo.out' });
  assert.deepEqual(['festival', 'dates', 'name', 'name-2', 'photo'].map((id) => by[id]!.at), ['0.5b', '1b', '1.5b', '2b', '2.5b']);
  assert.deepEqual(by.photo!.enter, { move: 'slot-up', duration: '1b' });
  assert.deepEqual(by.dates!.place, { x: 454, y: 102, anchor: 'top-left', unit: 'px' });
  assert.deepEqual(by['rule-1']!.params, { width: 1900, height: 2, radius: 0 });
  // It is a valid scene as it stands.
  const r = resolveFilm({ motion: '0.4', size: [1080, 1920], fps: 60, tempo: { bpm: 120 }, scenes: [s] });
  assert.deepEqual(r.issues.filter((i) => i.level === 'error'), []);
});
