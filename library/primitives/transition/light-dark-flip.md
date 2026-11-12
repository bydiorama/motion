---
slug: transition/light-dark-flip
kind: primitive
group: transition
summary: The background inverts behind a held element.
status: draft
origin: observed
observations: 1
energy: medium
params:
  duration:
    default: 0.3
    min: 0.2
    max: 0.4
    unit: s
related:
- texture/dither
since: 0.3.0
---

## Behaviour

One element stays in place while the canvas switches between light and dark. Texture and text colour switch with it.

## Rules

- The held element must be readable on both backgrounds.
