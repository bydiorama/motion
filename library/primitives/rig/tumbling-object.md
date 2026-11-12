---
slug: rig/tumbling-object
kind: primitive
group: rig
summary: A cube or tile that turns in quarter steps.
status: draft
origin: observed
observations: 1
energy: medium
params:
  step:
    default: 0.5
    min: 0.4
    max: 0.7
    unit: s
related:
- scene/hero-object
since: 0.3.0
---

## Behaviour

The object rotates 90 degrees at a time with a small overshoot, showing a different face each step.

## Rules

- Each face carries one mark.
