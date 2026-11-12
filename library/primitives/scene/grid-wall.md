---
slug: scene/grid-wall
kind: primitive
group: scene
summary: A masonry or regular grid of media.
status: draft
origin: observed
observations: 1
energy: medium
params:
  columns:
    default: 4
    min: 3
    max: 6
    unit: cols
  drift_speed:
    default: 20
    min: 10
    max: 40
    unit: px/s
related:
- fx/stagger-fill
since: 0.3.0
---

## Behaviour

Tiles fill in by stagger, then the whole wall drifts slowly.

## Rules

- Fill completes within 1 s.
- Drift direction stays constant.
