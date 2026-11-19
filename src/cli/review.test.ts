import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveFilm } from '../film/resolve.ts';
import type { Film } from '../film/types.ts';
import { filmCuts } from './review.ts';

test('filmCuts: plain cuts, hand-overs, and camera punches exempt from jumps', () => {
  const film = {
    motion: '0.5', size: [1080, 1080], fps: 60,
    scenes: [
      { id: 'a', length: 2, layers: [{ id: 't', use: 'el/text', props: { text: 'A' } }],
        camera: [{ at: 0, zoom: 1 }, { at: 1, zoom: 1.4, ease: 'punch' }, { at: 1.5, zoom: 1.4 }, { at: 1.7, zoom: 1.6 }] },
      { id: 'b', length: 2, layers: [{ id: 't', use: 'el/text', props: { text: 'B' } }] },
    ],
  } as unknown as Film;
  const { timeline } = resolveFilm(film);
  assert.ok(timeline);
  const { cuts, spans } = filmCuts(timeline);
  assert.deepEqual(cuts, [120]);
  // The punch on `punch` (0 → 1 s) and the quarter-second move (1.5 → 1.7 s); the hold between is judged.
  assert.deepEqual(spans, [[0, 61], [90, 103]]);
});
