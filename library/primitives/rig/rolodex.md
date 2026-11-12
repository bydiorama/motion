---
slug: rig/rolodex
kind: primitive
group: rig
summary: Cards on a short cylinder that spins while the whole rig swings.
status: draft
origin: observed
observations: 1
energy: medium
params:
  cards:
    default: 4
    min: 3
    max: 6
    unit: cards
  period:
    default: 18
    min: 15
    max: 20
    unit: s
related: []
since: 0.3.0
---

## Behaviour

Cards rotate around a shared axis. The rig itself swings between vertical, diagonal and horizontal.

## Rules

- The swing returns to its start pose at the loop point.
