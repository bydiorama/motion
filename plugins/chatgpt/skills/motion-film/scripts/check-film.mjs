// The package builder bundles these imports so the installed skill needs only Node.
import { readFileSync } from 'node:fs';
import { resolveFilm } from '../../../../../src/film/resolve.ts';
import { describePace, pace } from '../../../../../src/film/pace.ts';

try {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node check-film.mjs <film.json>');
  const result = resolveFilm(JSON.parse(readFileSync(file, 'utf8')));
  for (const issue of result.issues) console.log(JSON.stringify(issue));
  if (result.ok && result.timeline) {
    console.log(describePace(result.timeline, pace(result.timeline)));
  } else {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
