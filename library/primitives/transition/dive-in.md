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
    max: 1.2
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
  pace:
    default: accelerate
    options:
    - accelerate
    - glide
related:
- transition/iris
- transition/zoom-through-letter
since: 0.3.0
---

## Behaviour

The camera dives into a point of the current scene — scaling it up sharply while it blurs — and the next scene arrives out of that point.

Two paces. `accelerate` hits the cut at speed and the next scene lands out of a slight over-zoom: an energetic hand-over. `glide` is one eased push that arrives at rest: the zoom is geometric so its speed on screen is even, it blurs only while it moves (none at either end), and the next scene is already at its own size when it shows. Use `glide` when the point you dive into continues as the next scene, a match cut.

## Rules

- `accelerate`: short, 0.4–0.9 s. `glide`: 0.8–1.2 s.
- Pick a point with something on it: a letter, a dot, a button.
