---
slug: scene/end-card
kind: primitive
group: scene
summary: The logo alone.
status: specified
origin: observed
observations: 3
energy: low
params:
  hold:
    default: 1.5
    min: 1
    max: 2
    unit: s
related:
- transition/collapse-to-anchor
since: 0.3.0
---

## Behaviour

The logo sits centred on a clean background and holds.

## Rules

- Nothing else on screen.
- Last motion ends before the hold starts.
