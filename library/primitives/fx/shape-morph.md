---
slug: fx/shape-morph
kind: primitive
group: fx
summary: One shape grows in, then turns into the next, and the next.
status: specified
origin: observed
observations: 4
energy: medium
params:
  hold:
    default: 0.6
    min: 0.2
    max: 2
    unit: s
  morph:
    default: 0.7
    min: 0.4
    max: 1.2
    unit: s
  size:
    default: 22
    min: 6
    max: 60
    unit: '% of stage width'
  turn:
    default: 90
    min: 0
    max: 180
    unit: deg
related:
- scene/logo-reveal
- fx/grid-ripple
since: 0.5.0
---

## Behaviour

A shape turns into the next one in a list — circle, squircle, star, blob and so on — with a quarter turn as it changes. Each shape holds, then morphs.

## Rules

- Shapes are resampled to the same number of points, starting at the top, so the morph never twists.
- Morph on a long in-out curve: the shape lingers at both ends and moves through the middle.
- Hold each shape at least 0.2 s.
