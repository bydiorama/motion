import assert from 'node:assert/strict';
import { test } from 'node:test';
import { artboardFit, clipFor, cutPolygon, placedMaxWidth, placedRoom, wipeSide } from './mount.ts';

test('a mask leaves room above and below the line, and opens its sides', () => {
  // Entering from below: the window's bottom is pulled back by the travel, its top is padded.
  const entering = clipFor({ clip: [0, 0, 0, 0], yShare: 1 });
  assert.match(entering, /^inset\(calc\(-1 \* var\(--m-mask-pad, 0\.3em\)\) -100% calc\(\(100\.000% \+ 2\.0000 \* var\(--m-mask-pad, 0\.3em\)\) - var\(--m-mask-pad, 0\.3em\)\) -100%\)$/);
  // Leaving through the top: mirrored.
  const leaving = clipFor({ clip: [0, 0, 0, 0], yShare: -0.5 });
  assert.ok(leaving.startsWith('inset(calc((50.000% + 1.0000 * '), leaving);
  assert.ok(leaving.includes(') -100% calc(-1 * '), leaving);
});

test('at rest nothing is clipped, so the end of a mask cannot jump', () => {
  assert.equal(clipFor({ clip: [0, 0, 0, 0], yShare: 0 }), '');
});

test('wipes still clip at the box edge', () => {
  assert.equal(clipFor({ clip: [0.25, 0, 0, 0], yShare: 0 }), 'inset(25.000% 0.000% 0.000% 0.000%)');
});

test('a placed layer may be as wide as its anchor leaves room for', () => {
  assert.equal(placedRoom({ x: 50 }), 100);
  assert.equal(placedRoom({ x: 30 }), 60);
  assert.equal(placedRoom({ x: 10, anchor: 'top-left' }), 90);
  assert.equal(placedRoom({ x: 70, anchor: 'right' }), 70);
  assert.equal(placedRoom({ x: 98, anchor: 'left' }), 20);
});

test('a slot move is cut off at its own box, by the px it has travelled', () => {
  assert.equal(clipFor({ clip: [0, 0, 0, 0], yShare: 0, slot: 24 }), 'inset(0.000% 0.000% 24.00px 0.000%)');
  assert.equal(clipFor({ clip: [0, 0, 0, 0], yShare: 0, slot: -10 }), 'inset(10.00px 0.000% 0.000% 0.000%)');
  assert.equal(clipFor({ clip: [0, 0, 0, 0], yShare: 0, slot: 0 }), '');
});

test('on a canvas the camera travels, a placed layer may run past the stage edge', () => {
  assert.equal(placedMaxWidth({ x: 0, anchor: 'top-left' }, false, 1080), '1080px');
  assert.equal(placedMaxWidth({ x: 50 }, false, 1080), '1080px');
  assert.equal(placedMaxWidth({ x: 0, anchor: 'top-left' }, true, 1080), 'none');
});

test('a wipe\'s edge travels the way it is named, in and out', () => {
  // In: the clip sits ahead of the edge and shrinks. wipe-right uncovers left to right.
  assert.equal(wipeSide('wipe-right', false), 1);
  assert.equal(wipeSide('wipe-left', false), 3);
  assert.equal(wipeSide('wipe-up', false), 0);
  assert.equal(wipeSide('wipe-down', false), 2);
  // Out: the clip grows behind the edge. wipe-right covers from the left edge.
  assert.equal(wipeSide('wipe-right', true), 3);
  assert.equal(wipeSide('wipe-left', true), 1);
  assert.equal(wipeSide('wipe-up', true), 2);
  assert.equal(wipeSide('wipe-down', true), 0);
});

test('an artboard is scaled to meet the stage as its fit says, and aligned in what is left', () => {
  const slide = { width: 1920, height: 1080 }, phone: [number, number] = [1080, 1920];
  // A 16:9 slide covering a 9:16 phone: stage height, its sides fall off evenly.
  const cover = artboardFit(phone, slide);
  assert.ok(Math.abs(cover.scale - 1920 / 1080) < 1e-9);
  assert.equal(cover.y, 0);
  assert.ok(Math.abs(cover.x - (1080 - 1920 * cover.scale) / 2) < 1e-9);
  // Contained: stage width, letterboxed top and bottom.
  const contain = artboardFit(phone, { ...slide, fit: 'contain' });
  assert.equal(contain.scale, 1080 / 1920);
  assert.equal(contain.x, 0);
  assert.ok(Math.abs(contain.y - (1920 - 1080 * contain.scale) / 2) < 1e-9);
  // Aligned to the left edge instead of centred.
  assert.equal(artboardFit(phone, { ...slide, align: [0, 50] }).x, 0);
  // Matching one side regardless of the other.
  assert.equal(artboardFit(phone, { ...slide, fit: 'width' }).scale, 1080 / 1920);
  // Without an artboard of its own, a scene's artboard is the stage: px are stage px.
  assert.deepEqual(artboardFit(phone, { width: 1080, height: 1920 }), { scale: 1, x: 0, y: 0 });
});

test('an angled wipe cuts the box square to its direction', () => {
  const none: [number, number, number, number] = [0, 0, 0, 0];
  const round = (pts: [number, number][]) => pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
  // At 0 degrees, halfway in, it is wipe-right: the left half shows.
  assert.deepEqual(round(cutPolygon(200, 100, none, { angle: 0, hidden: 0.5, leaving: false })), [[0, 0], [100, 0], [100, 100], [0, 100]]);
  // Leaving the same way, the left half has gone.
  assert.deepEqual(round(cutPolygon(200, 100, none, { angle: 0, hidden: 0.5, leaving: true })), [[100, 0], [200, 0], [200, 100], [100, 100]]);
  // At 45 degrees on a square, halfway: the triangle above the diagonal from top-right to bottom-left.
  assert.deepEqual(round(cutPolygon(100, 100, none, { angle: 45, hidden: 0.5, leaving: false })), [[0, 0], [100, 0], [0, 100]]);
  // Fully hidden: nothing; and the clip says so.
  assert.equal(cutPolygon(100, 100, none, { angle: 200, hidden: 1, leaving: false }).length, 0);
  assert.equal(clipFor({ clip: none, yShare: 0, cut: { angle: 10, hidden: 1, leaving: false } }, [100, 100]), 'polygon(0 0, 0 0, 0 0)');
  // Fully shown: no clip at all.
  assert.equal(clipFor({ clip: none, yShare: 0, cut: { angle: 10, hidden: 0, leaving: false } }, [100, 100]), '');
});
