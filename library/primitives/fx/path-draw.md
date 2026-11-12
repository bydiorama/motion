---
slug: fx/path-draw
kind: primitive
group: fx
summary: Lines draw themselves along their paths, then the shapes fill.
status: specified
origin: observed
observations: 5
energy: medium
params:
  draw:
    default: 1
    min: 0.4
    max: 2.5
    unit: s
  stagger:
    default: 0.12
    min: 0
    max: 0.5
    unit: s
  width:
    default: 30
    min: 4
    max: 100
    unit: '% of stage width'
  stroke:
    default: 2
    min: 0.5
    max: 12
    unit: px
  fill_time:
    default: 0.4
    min: 0.1
    max: 1
    unit: s
related:
- type/scribble-highlight
- scene/logo-reveal
since: 0.5.0
---

## Behaviour

One or more vector paths draw on as if traced by a pen, one after another; the fill can follow once the stroke is complete.

## Rules

- Draw at a steady speed; when several strokes chain, each takes time in proportion to its length.
- Round caps and joins.
- Stroke first, then fill: the fill fades in over 0.1–1 s after the last stroke.
