// The catalog: everything a film may use, as data. An agent reads this instead
// of the source; the studio builds its dials from it; tools/validate.py checks
// it against the library entries.
import { EASE_NAMES } from './core/ease.ts';
import { ANCHORS, MOVE_NAMES, SURFACES, TEXT_SIZES, TONES, TRACK_PROPS } from './film/types.ts';
import { PRIMITIVES, TRANSITIONS } from './primitives/index.ts';
import { DEFAULT_TOKENS } from './tokens.ts';
import { VERSION } from './version.ts';

export function buildCatalog() {
  return {
    motion: VERSION,
    tokens: DEFAULT_TOKENS,
    eases: EASE_NAMES,
    moves: MOVE_NAMES,
    tracks: TRACK_PROPS,
    sizes: TEXT_SIZES,
    colors: TONES,
    surfaces: SURFACES,
    anchors: ANCHORS,
    primitives: Object.values(PRIMITIVES).map(({ slug, summary, props, params }) => ({ slug, summary, props, params })),
    transitions: Object.values(TRANSITIONS).map(({ slug, summary, params, calm }) => ({ slug, summary, params, ...(calm ? { calm } : {}) })),
  };
}

export type Catalog = ReturnType<typeof buildCatalog>;
