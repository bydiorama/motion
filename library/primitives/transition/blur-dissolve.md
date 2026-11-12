---
slug: transition/blur-dissolve
kind: primitive
group: transition
summary: One scene blurs out while the next blurs in.
status: draft
origin: observed
observations: 1
energy: low
params:
  duration:
    default: 0.4
    min: 0.3
    max: 0.6
    unit: s
  blur:
    default: 20
    min: 12
    max: 30
    unit: px
  overlap:
    default: 0.5
    min: 0.3
    max: 0.7
    unit: ratio
related: []
since: 0.3.0
---

## Behaviour

The outgoing scene gains blur and loses opacity. The incoming scene does the reverse, overlapping in time.

## Rules

- Use between scenes with different layouts.
