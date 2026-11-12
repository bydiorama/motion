---
slug: transition/beat-cut
kind: primitive
group: transition
summary: A plain cut placed on a music beat.
status: specified
origin: observed
observations: 2
energy: medium
params:
  duration:
    default: 0
    min: 0
    max: 0
    unit: s
related:
- transition/layout-locked-swap
since: 0.3.0
---

## Behaviour

No animation. The layout stays the same and the content changes.

## Rules

- Only works when consecutive scenes share a layout.
