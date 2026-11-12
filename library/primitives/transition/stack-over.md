---
slug: transition/stack-over
kind: primitive
group: transition
summary: The next scene slides over the current one, which recedes and dims beneath it.
status: specified
origin: observed
observations: 4
energy: medium
params:
  duration:
    default: 0.7
    min: 0.4
    max: 1.2
    unit: s
  direction:
    default: up
    options:
    - up
    - down
    - left
    - right
  recede:
    default: 0.94
    min: 0.88
    max: 0.98
    unit: x
  dim:
    default: 0.7
    min: 0.2
    max: 0.8
    unit: ratio
  radius:
    default: 2
    min: 0
    max: 6
    unit: '% of width'
related:
- transition/push
- transition/cover-reveal
since: 0.5.0
---

## Behaviour

The next scene slides over the current one like a card on a stack, while the one underneath recedes, dims and takes on rounded corners.

## Rules

- The scene below scales to 0.88–0.98 and dims; it does not move sideways.
- The incoming scene has a soft shadow on its leading edge.
