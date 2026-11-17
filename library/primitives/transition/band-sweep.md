---
slug: transition/band-sweep
kind: primitive
group: transition
summary: Bands of colour run across the frame at angles, swell to cover the cut, then run on.
status: draft
origin: designed
energy: high
params:
  duration:
    default: 1
    min: 0.5
    max: 2
    unit: s
  direction:
    default: left
    options:
    - left
    - right
    - up
    - down
  bands:
    default: 5
    min: 2
    max: 8
    unit: bands
  width:
    default: 9
    min: 2
    max: 30
    unit: '% of frame'
  angle:
    default: 14
    min: 0
    max: 30
    unit: deg
  lag:
    default: 0.05
    min: 0
    max: 0.09
    unit: ratio
related:
- transition/cover-reveal
- transition/step-wipe
- transition/slant-wipe
since: 0.5.0
---

## Behaviour

Bands of solid colour are thrown across the frame, like ribbons or straps laid over it. Each one enters from one side and streams along its own length, a step after the one before, and each sits at a slightly different tilt, alternating sides, so they cross. While they travel they swell from narrow ribbons into broad bands, until together they cover the whole frame. The cut happens under them. Then they run on out the far side, narrowing as they go, and leave the next scene behind; it settles from a slight push.

Colours come from `--m-band-1` to `--m-band-6` on the stage (set them under `theme.vars` with an identity's palette); without them the bands take the accent, inverse and surface colours.

## Rules

- Use an identity's own colours, in a fixed order, and one band per colour where possible: the sweep is a moment of the palette.
- 4–6 bands. Two read as a wipe, eight as stripes.
- Keep the tilt small (8–16°): crossing ribbons, not a scattered pile. Tilts alternate side to side, so where the bands meet their edges zig-zag: right for ribbons and lanyards, wrong for an identity built on a level, ruled grid.
- `angle: 0` lays the bands flat and parallel, each exactly its share of the frame: with 4 bands on an 8-row grid every band is two rows, its edges on the rules. The hand-over then speaks the grid's own language.
- It is a loud hand-over. Once or twice in a film, at the turns of the story, not between every scene.
- Short against what it joins: one or two beats, at most a quarter of the shorter scene and half of one picture's time beside it. Longer, it reads as a section of its own.
- Run the bands with the reading direction (left) going forward, and the other way when the film turns back.
