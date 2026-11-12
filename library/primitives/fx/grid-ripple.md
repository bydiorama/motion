---
slug: fx/grid-ripple
kind: primitive
group: fx
summary: A field of dots or tiles appears in a wave from one point, then keeps breathing.
status: specified
origin: observed
observations: 3
energy: low
params:
  cols:
    default: 24
    min: 8
    max: 48
    unit: columns
  stagger:
    default: 0.05
    min: 0.02
    max: 0.1
    unit: s
  from:
    default: center
    options:
    - start
    - end
    - center
    - edges
    - random
  size:
    default: 0.22
    min: 0.05
    max: 0.9
    unit: ratio of cell
  pulse:
    default: 0.35
    min: 0
    max: 1
    unit: ratio
  opacity:
    default: 0.5
    min: 0.1
    max: 1
    unit: ratio
related:
- fx/stagger-fill
- texture/halftone-field
since: 0.5.0
---

## Behaviour

A field of dots or squares grows in from an origin — the centre, the edges, a corner or at random — by distance, then breathes once as a wave passes through it.

## Rules

- Delay is by distance from the origin in grid units, not by index.
- Keep the field quiet: 10–50% opacity behind content.
- The ripple passes once; it does not loop behind a headline.
