---
slug: fx/marquee-highlight
kind: primitive
group: fx
summary: Scrolling rows with one item emphasised.
status: draft
origin: observed
observations: 1
energy: low
params:
  dim_opacity:
    default: 0.5
    min: 0.4
    max: 0.6
    unit: ratio
related:
- scene/marquee-wall
since: 0.3.0
---

## Behaviour

All items scroll. One gets an accent border and full opacity while the others dim.

## Rules

- The highlighted item should pass near the centre.
