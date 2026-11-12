import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FEELS } from '../brief/brief.ts';
import type { Feel } from '../brief/types.ts';
import { buildCatalog } from '../catalog.ts';
import { readLibrary } from '../cli/library.ts';
import { resolveFilm } from '../film/resolve.ts';
import type { Film } from '../film/types.ts';
import { feelPreview, movePreview, typePreview } from './previews.ts';

const catalog = buildCatalog(), library = readLibrary();
const errors = (f: Film) => resolveFilm(f).issues.filter((i) => i.level === 'error').map((i) => `${i.path}: ${i.message}`);

test('every drawable move has a thumbnail, and it is a valid film', () => {
  for (const slug of [...catalog.primitives, ...catalog.transitions].map((p) => p.slug).filter((s) => !s.startsWith('el/'))) {
    const f = movePreview(slug, 'light');
    assert.ok(f, `${slug} has no preview`);
    assert.deepEqual(errors(f), [], slug);
  }
});

test('every feel and video type has a valid thumbnail', () => {
  for (const f of Object.keys(FEELS) as Feel[]) assert.deepEqual(errors(feelPreview(f, 'dark')), [], f);
  for (const n of library.narratives) assert.deepEqual(errors(typePreview(n, 'light')), [], n.slug);
});
