import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rowAt, rowLag, rowSpan } from './strip-wipe.ts';

const linear = (x: number) => x;

test('rows start a step apart and all finish with the hand-over', () => {
  const lag = rowLag(8, 0.04);
  assert.equal(rowAt(0, 0, 8, lag, 'down', linear), 0);
  assert.ok(rowAt(0.2, 0, 8, lag, 'down', linear) > rowAt(0.2, 7, 8, lag, 'down', linear));
  for (let i = 0; i < 8; i++) assert.equal(rowAt(1, i, 8, lag, 'down', linear), 1);
  // Up runs the other way round; from the centre, the middle rows lead.
  assert.ok(rowAt(0.2, 7, 8, lag, 'up', linear) > rowAt(0.2, 0, 8, lag, 'up', linear));
  assert.ok(rowAt(0.2, 3, 8, lag, 'centre', linear) > rowAt(0.2, 0, 8, lag, 'centre', linear));
});

test('the stagger never leaves the last row less than half the hand-over', () => {
  assert.equal(rowLag(16, 0.1), 0.5 / 15);
  assert.equal(rowLag(8, 0.04), 0.04);
});

test('a row enters with its colour field first and leaves the next scene whole', () => {
  assert.deepEqual(rowSpan(0, 1080, 378), { front: 1080, back: 1458 });
  assert.deepEqual(rowSpan(1, 1080, 378), { front: -378, back: 0 });
});

test('the field takes a band of the palette, or a surface of the stage', async () => {
  const { stripColour } = await import('./strip-wipe.ts');
  assert.match(stripColour('band-2'), /^var\(--m-band-2,/);
  assert.equal(stripColour('accent'), 'var(--m-bg-accent)');
});

test('cover mode closes every row in colour on the cut, then opens on the next scene', async () => {
  const { rowLayout } = await import('./strip-wipe.ts');
  const o = { mode: 'cover', field: 0, lag: rowLag(8, 0.04), order: 'down', ease: linear };
  // Half way, the frame is colour from edge to edge and the next scene is hidden.
  for (let i = 0; i < 8; i++) assert.deepEqual(rowLayout(0.5, i, 8, 1080, o), { field: [0, 1080], shown: null });
  // Before it, the first row is further over than the last; nothing of the next scene shows.
  const a = rowLayout(0.2, 0, 8, 1080, o), b = rowLayout(0.2, 7, 8, 1080, o);
  assert.ok(a.field[0] < b.field[0]);
  assert.equal(a.shown, null);
  // After it, the field runs on out the far side and the next scene follows it in.
  const c = rowLayout(0.75, 0, 8, 1080, o);
  assert.ok(c.shown && c.shown[0] === c.field[1] && c.shown[1] === 1080);
  assert.deepEqual(rowLayout(1, 7, 8, 1080, o), { field: [0, 0], shown: [0, 1080] });
});

test('lead mode shows the next scene right behind the field', async () => {
  const { rowLayout } = await import('./strip-wipe.ts');
  const o = { mode: 'lead', field: 378, lag: 0, order: 'down', ease: linear };
  assert.deepEqual(rowLayout(0, 0, 8, 1080, o), { field: [1080, 1458], shown: null });
  assert.deepEqual(rowLayout(1, 0, 8, 1080, o), { field: [-378, 0], shown: [0, 1080] });
});
