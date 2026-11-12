---
slug: texture/gradient-drift
kind: primitive
group: texture
summary: Soft fields of colour drift and blend behind the content, looping without a seam.
status: specified
origin: observed
observations: 4
energy: low
params:
  period:
    default: 12
    min: 6
    max: 24
    unit: s
  fields:
    default: 4
    min: 2
    max: 6
    unit: fields
  softness:
    default: 14
    min: 6
    max: 24
    unit: '% of stage width'
  reach:
    default: 0.18
    min: 0.05
    max: 0.35
    unit: ratio
  strength:
    default: 0.85
    min: 0.2
    max: 1
    unit: ratio
related:
- texture/grain
- texture/halftone-field
since: 0.5.0
---

## Behaviour

Soft colour fields drift slowly behind the content, blending into one another, on a seamless loop.

## Rules

- Slow: one loop takes 6–24 s.
- Keep strength low behind text so contrast holds.
- Add `texture/grain` over it so the gradient does not band.
