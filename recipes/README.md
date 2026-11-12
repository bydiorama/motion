# Recipes

One JavaScript module per primitive, at the same path as its slug: `recipes/type/word-build.js` implements `type/word-build`.

## Contract

```js
export const slug = 'type/word-build';
export const defaults = { /* same names and defaults as the entry's params */ };

export function build(root, params, ctx) {
  // root:   the element to draw into
  // params: overrides of defaults
  // ctx:    { copy, assets, tokens, brand, seed }
  return {
    duration,          // seconds
    seek(t) { ... },   // draw the exact state at time t
  };
}
```

Rules:

1. `seek(t)` depends only on `t`. No clock, no `requestAnimationFrame`, no CSS transitions.
2. Randomness comes from `rng(seed)` in `_lib/ease.js`.
3. Easing names come from `tokens.yaml`.
4. No brand values in the recipe; they arrive through `ctx.brand`.
5. A recipe that wraps a timeline library (for example GSAP) must build it paused and implement `seek` by setting its time.

## Preview and check

`_harness.html?recipe=type/word-build&t=0.6` shows one frame (serve the folder over HTTP).
`python3 tools/check_recipe.py type/word-build` checks repeatable seeking and saves frames to `out/`.

## State

`type/word-build` is the reference implementation of the contract. Its entry stays `draft` until the entry itself is approved.
