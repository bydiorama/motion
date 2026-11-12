---
slug: transition/iris
kind: primitive
group: transition
summary: The next scene opens from a point in a growing circle.
status: specified
origin: observed
observations: 3
energy: medium
params:
  duration:
    default: 0.8
    min: 0.4
    max: 1.4
    unit: s
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
  shape:
    default: circle
    options:
    - circle
    - rounded
  push_in:
    default: 0.06
    min: 0
    max: 0.2
    unit: ratio
related:
- transition/dive-in
- transition/blur-dissolve
since: 0.5.0
---

## Behaviour

The next scene opens through a growing circle or rounded rectangle from a chosen point, while it pushes in a little.

## Rules

- Open from the point the eye is already on.
- The aperture grows on a fast ease-out; the push-in is subtle (under 10%).
