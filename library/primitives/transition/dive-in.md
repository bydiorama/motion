---
slug: transition/dive-in
kind: primitive
group: transition
summary: The camera pushes into a point until it fills the frame.
status: specified
origin: observed
observations: 3
energy: high
params:
  duration:
    default: 0.5
    min: 0.4
    max: 0.9
    unit: s
  scale_to:
    default: 8
    min: 3
    max: 12
    unit: x
  x:
    default: 50
    min: 0
    max: 100
    unit: '% of width'
  y:
    default: 50
    min: 0
    max: 100
    unit: '% of height'
related:
- transition/iris
- transition/zoom-through-letter
since: 0.3.0
---

## Behaviour

The camera dives into a point of the current scene — scaling it up sharply while it blurs — and the next scene arrives out of that point.

## Rules

- Short: 0.4–0.9 s, accelerating into the point.
- Pick a point with something on it: a letter, a dot, a button.
