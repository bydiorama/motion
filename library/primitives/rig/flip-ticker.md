---
slug: rig/flip-ticker
kind: primitive
group: rig
summary: A row of cards where a rotation wave travels along the row.
status: draft
origin: observed
observations: 1
energy: low
params:
  period:
    default: 13.5
    min: 10
    max: 15
    unit: s
related: []
since: 0.3.0
---

## Behaviour

Cards move sideways. The Y rotation of each card depends on its x position.

## Rules

- Translate by a whole number of tile periods per loop.
