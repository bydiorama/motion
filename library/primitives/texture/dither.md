---
slug: texture/dither
kind: primitive
group: texture
summary: Ordered dither of a soft shape.
status: draft
origin: observed
observations: 1
energy: low
params:
  cell:
    default: 4
    min: 2
    max: 8
    unit: px
related:
- transition/light-dark-flip
since: 0.3.0
---

## Behaviour

A blurred shape is rendered through an ordered dither pattern.

## Rules

- Animate the shape underneath, not the dots.
