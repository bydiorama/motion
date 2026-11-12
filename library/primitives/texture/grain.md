---
slug: texture/grain
kind: primitive
group: texture
summary: Fine film grain over the frame, changing a set number of times a second.
status: specified
origin: observed
observations: 4
energy: low
params:
  amount:
    default: 0.08
    min: 0.02
    max: 0.25
    unit: ratio
  rate:
    default: 12
    min: 0
    max: 24
    unit: per s
  size:
    default: 1
    min: 0.5
    max: 3
    unit: x
related:
- texture/gradient-drift
since: 0.5.0
---

## Behaviour

Fine film grain over the whole frame, changing a set number of times per second.

## Rules

- Subtle: 2–25% strength.
- Grain changes at 12 frames per second or less, not at the film's frame rate.
- Seeded by frame, so every render is identical.
