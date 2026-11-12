// Tuning: a person's overrides and notes, kept in their own file beside the film.
//
// The agent owns `x.film.json`; the person owns `x.tune.json`. Overrides address
// scenes and layers by id, never by position, so they survive the agent
// rewriting, reordering or regenerating the film. An override whose target is
// gone is reported as an orphan instead of being dropped without a word.
import type { Film, Tune } from './types.ts';

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

/** Arrays in a film whose items are found by `id`. */
const ID_LISTS = new Set(['scenes', 'layers']);

export interface TuneResult {
  film: Film;
  /** Paths that no longer point at anything in the film. */
  orphans: string[];
  applied: string[];
}

function setPath(root: Json, path: string, value: unknown): boolean {
  const parts = path.split('.');
  let cur: unknown = root;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i]!;
    const last = i === parts.length - 1;
    if (Array.isArray(cur)) {
      // Inside scenes or layers: the segment is an id.
      const found = cur.find((item) => isObject(item) && item.id === key);
      if (!found) return false;
      if (last) return false; // an override may change a scene or layer, not replace it
      cur = found;
      continue;
    }
    if (!isObject(cur)) return false;
    if (last) {
      if (value === null) delete cur[key];
      else cur[key] = value;
      return true;
    }
    if (cur[key] === undefined) {
      if (ID_LISTS.has(key)) return false;
      cur[key] = {};
    }
    // A move written as a bare name ("rise") opens up into its full form when part of it is tuned.
    if ((key === 'enter' || key === 'exit') && typeof cur[key] === 'string') cur[key] = { move: cur[key] };
    cur = cur[key];
  }
  return false;
}

/** Returns a copy of the film with the tune's overrides applied. `null` removes a value. */
export function applyTune(film: Film, tune: Tune | undefined): TuneResult {
  const out = structuredClone(film) as Film;
  const orphans: string[] = [], applied: string[] = [];
  for (const [path, value] of Object.entries(tune?.set ?? {})) {
    (setPath(out as unknown as Json, path, structuredClone(value)) ? applied : orphans).push(path);
  }
  return { film: out, orphans, applied };
}

/** Reads the value at a path, using the same addressing as overrides. */
export function getPath(root: unknown, path: string): unknown {
  let cur = root;
  for (const key of path.split('.')) {
    if (Array.isArray(cur)) cur = cur.find((item) => isObject(item) && item.id === key);
    else if (isObject(cur)) cur = cur[key];
    else return undefined;
  }
  return cur;
}

/** Writes the overrides into the film itself: what a person does once the tuning is agreed. */
export function bake(film: Film, tune: Tune | undefined): { film: Film; tune: Tune; orphans: string[] } {
  const { film: baked, orphans } = applyTune(film, tune);
  const keep = Object.fromEntries(Object.entries(tune?.set ?? {}).filter(([p]) => orphans.includes(p)));
  return { film: baked, tune: { set: keep, notes: tune?.notes ?? [] }, orphans };
}
