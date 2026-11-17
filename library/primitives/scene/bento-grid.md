---
slug: scene/bento-grid
kind: primitive
group: scene
summary: Tiles of different sizes on one grid, each cycling its own content on its own clock.
status: draft
origin: observed
observations: 1
energy: medium
params:
  width:
    default: 92
    min: 30
    max: 100
    unit: '% of stage width'
  gap:
    default: 14
    min: 0
    max: 60
    unit: px
  hold:
    default: 1.6
    min: 0.4
    max: 6
    unit: s
  swap:
    default: mixed
    options:
    - mixed
    - slide-up
    - slide-left
    - flip
    - stack
    - fade
  swap_time:
    default: 0.7
    min: 0.2
    max: 2
    unit: s
  offset:
    default: 0.3
    min: 0
    max: 2
    unit: s
  stagger:
    default: 0.06
    min: 0
    max: 0.2
    unit: s
related:
- scene/grid-wall
- transition/layout-locked-swap
- fx/slow-push
since: 0.5.0
---

## Behaviour

A bento: tiles of different sizes share one grid, laid out by named areas (`"a b c / d b e / d f e"`: a name over several cells is one larger tile). Each tile is a small screen of its own. It holds an item, then swaps to the next, and on round its items, once every period (hold plus swap). Tiles swap a phase apart in reading order, so the grid is never still and never changes all at once. A tile with a single item holds: the wordmark, the title.

Each tile has one swap move, kept for all its swaps: the new item slides up or in from the side and pushes the old one out, the card flips in its slot, the new item comes down over the old one which sinks back and dims (a stack of messages), or the new one dissolves over the old. With `swap: mixed`, neighbours get different moves. Pictures drift slowly inside their tile while they can be seen.

The grid can open from the centre outwards, tile by tile, or be there from the first frame.

## Rules

- One idea per tile; the brand mark holds still in its own tile while the others cycle around it.
- Swaps ease in and out and take 0.5–0.9 s; an item rests at least 1.2 s before its tile swaps again.
- Phase the tiles 0.2–0.5 s apart: every tile at once reads as a slide change, not as a living grid. Beside scenes of whole pictures, calm it further: one tile at a time, the next starting as the last lands.
- To open and close a film on the same wall, split one wall across the loop: the closing scene shows the swaps that lead into the opening frame, each tile ending on the item the opening starts with, a whole period after its last swap.
- At most two or three swap moves in one grid. A move belongs to its tile for the whole film.
- Never a dip through an empty tile: the old item stays whole until the new one covers it.
- For a loop, set `stagger` to 0 and give each tile a number of items that divides the largest; a scene as long as the layer's duration then ends on its first frame.
- Corners are three quarters of the gap, as on `scene/grid-wall`.
