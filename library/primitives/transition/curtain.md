---
slug: transition/curtain
kind: primitive
group: transition
summary: Two panels part or close.
status: specified
origin: observed
observations: 3
energy: medium
params:
  duration:
    default: 0.8
    min: 0.5
    max: 1.4
    unit: s
  axis:
    default: vertical
    options:
    - vertical
    - horizontal
  fill:
    default: inverse
    options:
    - inverse
    - accent
    - surface
    - base
related:
- transition/step-wipe
- transition/cover-reveal
- type/parting
since: 0.3.0
---

## Behaviour

Two panels close over the current scene from opposite edges, meet in the middle, then part to reveal the next one.

## Rules

- The panels meet exactly in the middle and part without a pause longer than a frame or two.
- Strong in-out curve on both halves.
