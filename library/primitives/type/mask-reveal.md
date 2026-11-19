---
slug: type/mask-reveal
kind: primitive
group: type
summary: Lines or words slide up from under an edge, one after another.
status: specified
origin: observed
observations: 5
energy: medium
params:
  unit:
    default: line
    options:
    - line
    - word
  stagger:
    default: 0.08
    min: 0.04
    max: 0.16
    unit: s
  duration:
    default: 0.9
    min: 0.5
    max: 1.4
    unit: s
  tilt:
    default: 0
    min: 0
    max: 8
    unit: deg
  from:
    default: start
    options:
    - start
    - end
    - center
    - edges
    - random
  ease:
    default: expressive.out
    unit: ease
  feather:
    default: 0
    min: 0
    max: 0.4
    unit: em
related:
- type/word-build
- type/char-cascade
- type/block-reveal
since: 0.5.0
---

## Behaviour

Text is split into lines (or words). Each unit sits inside its own clipping box and rises from just below its baseline, so it appears to be uncovered rather than faded in. Units follow one another with a short stagger; an optional tilt settles to level as the unit lands.

## Rules

- Travel is 100–110% of the unit's own height, never a fixed number of pixels.
- 0.6–0.9 s per line, 60–120 ms between lines.
- Use an expressive ease-out: the unit arrives in the first fifth of its time and glides for the rest.
- Leave out the opacity fade: the mask does the work.
- A hard mask line reads as a cut in the frame on large type. `feather` 0.1–0.12 em gives the edge a soft ramp the line rises out of; the ramp sits below the line's own room, so nothing at rest is faded.
- Lines go in reading order; exits go in reverse order and take 60–75% of the entrance time.
