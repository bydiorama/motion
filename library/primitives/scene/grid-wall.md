---
slug: scene/grid-wall
kind: primitive
group: scene
summary: A masonry or regular grid of media.
status: specified
origin: observed
observations: 2
energy: medium
params:
  columns:
    default: 4
    min: 2
    max: 8
    unit: cols
  width:
    default: 90
    min: 20
    max: 200
    unit: '% of stage width'
  gap:
    default: 16
    min: 0
    max: 80
    unit: px
  stagger:
    default: 0.05
    min: 0.01
    max: 0.15
    unit: s
  focus_x:
    default: 50
    min: 0
    max: 100
    unit: '% of the wall'
  focus_y:
    default: 50
    min: 0
    max: 100
    unit: '% of the wall'
  drift_speed:
    default: 20
    min: 0
    max: 40
    unit: px/s
related:
- fx/stagger-fill
since: 0.3.0
---

## Behaviour

Pictures pack into columns, each under the shortest one, so mixed proportions make masonry and equal ones a regular grid. Tiles fill in by stagger, nearest a focus point first, so the wall opens outwards from where the eye already is. Then the whole wall drifts slowly.

## Rules

- Fill completes within 1 s for a wall that is the hero; a wall behind text may take longer.
- Open from the focus point: the subject the previous scene ended on, or the centre.
- Each tile rises a little and settles in scale while it fades in; the ease is the film's entrance ease.
- Drift direction stays constant. Set it to 0 when the wall is a still moment between moves.
- Corners are three quarters of the gap, so tiles and gaps read as one system.
