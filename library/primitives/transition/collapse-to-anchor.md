---
slug: transition/collapse-to-anchor
kind: primitive
group: transition
summary: Everything shrinks into one element that starts the next scene.
status: specified
origin: observed
observations: 2
energy: medium
params:
  duration:
    default: 0.6
    min: 0.5
    max: 0.8
    unit: s
related:
- scene/end-card
since: 0.3.0
---

## Behaviour

All elements scale and move into a single dot, chip or shape. That element then grows into the anchor of the next scene, such as an input field or a logo.

## Rules

- The anchor stays visible through the whole move.
