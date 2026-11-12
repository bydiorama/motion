---
slug: transition/dive-in
kind: primitive
group: transition
summary: The camera pushes into a point until it fills the frame.
status: draft
origin: observed
observations: 1
energy: high
params:
  duration:
    default: 0.5
    min: 0.4
    max: 0.6
    unit: s
  scale_to:
    default: 8
    min: 5
    max: 12
    unit: x
related:
- transition/zoom-through-letter
since: 0.3.0
---

## Behaviour

The view scales into one point of the current subject with motion blur. Cut at the brightest or flattest frame.

## Rules

- Pick a target with a flat colour so the cut is invisible.
