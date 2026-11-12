---
slug: transition/cover-reveal
kind: primitive
group: transition
summary: Colour panels sweep across and cover the cut, then sweep on to uncover the next scene.
status: specified
origin: observed
observations: 4
energy: high
params:
  duration:
    default: 1
    min: 0.6
    max: 1.6
    unit: s
  direction:
    default: up
    options:
    - up
    - down
    - left
    - right
  panels:
    default: 2
    min: 1
    max: 3
    unit: panels
  lag:
    default: 0.12
    min: 0
    max: 0.3
    unit: ratio
related:
- transition/curtain
- type/block-reveal
since: 0.5.0
---

## Behaviour

One to three coloured panels sweep across the frame and cover it; while they cover it, the scene changes; then they sweep off the far side to uncover the next scene.

## Rules

- Panels are the accent and inverse colours, staggered by up to 0.3 s.
- The scene changes only while it is fully covered.
- Panels travel on a strong in-out curve.
