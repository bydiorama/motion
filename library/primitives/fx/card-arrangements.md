---
slug: fx/card-arrangements
kind: primitive
group: fx
summary: Cards move between fan, stack, scatter and wheel layouts.
status: draft
origin: observed
observations: 1
energy: medium
params:
  duration:
    default: 0.7
    min: 0.5
    max: 1.0
    unit: s
related: []
since: 0.3.0
---

## Behaviour

A set of cards has several rest layouts and springs between them.

## Rules

- Use at most two layouts per scene.
