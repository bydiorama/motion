// @bydiorama/motion: films as data.
export { bezier, clamp, EASE_NAMES, lerp, progress, resolveEase, rng, spring, UI_EASE } from './core/ease.ts';
export type { Bezier, EaseSpec, SpringSpec } from './core/ease.ts';
export { track } from './core/track.ts';
export type { Key } from './core/track.ts';
export { DEFAULT_TOKENS, mergeTokens } from './tokens.ts';
export type { TokenOverrides, Tokens } from './tokens.ts';
export { describeTimeline, resolveFilm } from './film/resolve.ts';
export type { Resolution } from './film/resolve.ts';
export { applyTune, bake, getPath } from './film/tune.ts';
export type * from './film/types.ts';
export { PRIMITIVES, TRANSITIONS } from './primitives/index.ts';
export type { Ctx, ParamSpec, Primitive, PropSpec, TransitionPrimitive } from './primitives/index.ts';
export { buildCatalog } from './catalog.ts';
export { FilmError, mount } from './dom/mount.ts';
export type { LayerBox, Mounted, MountOptions } from './dom/mount.ts';
export { createPlayer, startPage } from './dom/page.ts';
export type { PageOptions, Player } from './dom/page.ts';
