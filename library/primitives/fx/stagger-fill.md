---
slug: fx/stagger-fill
kind: primitive
group: fx
summary: Items appear one after another.
status: specified
origin: observed
observations: 2
energy: medium
params:
  stagger:
    default: 0.04
    min: 0.02
    max: 0.06
    unit: s
related:
- scene/grid-wall
since: 0.3.0
---

## Behaviour

Each item fades or scales in slightly after the previous one.

## Rules

- Order by reading direction or by distance from the centre.
- Total fill time under 1 s.
