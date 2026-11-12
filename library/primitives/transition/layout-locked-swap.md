---
slug: transition/layout-locked-swap
kind: primitive
group: transition
summary: The frame stays still and only the inner content changes.
status: draft
origin: observed
observations: 1
energy: low
params:
  duration:
    default: 0.3
    min: 0.2
    max: 0.4
    unit: s
related:
- transition/beat-cut
- ui/tour-hold
since: 0.3.0
---

## Behaviour

Containers hold their position. Content inside them cross-fades or slides.

## Rules

- Good for tours with many similar screens.
