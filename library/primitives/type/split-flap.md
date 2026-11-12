---
slug: type/split-flap
kind: primitive
group: type
summary: Characters flip like a departure board.
status: draft
origin: observed
observations: 1
energy: medium
params:
  flip:
    default: 0.04
    min: 0.03
    max: 0.06
    unit: s
related: []
since: 0.3.0
---

## Behaviour

Each character cell flips through intermediate characters to its target.

## Rules

- Monospaced cells.
