---
slug: type/char-cascade
kind: primitive
group: type
summary: 'Letters arrive one by one: rising, turning, growing or coming into focus.'
status: specified
origin: observed
observations: 4
energy: high
params:
  stagger:
    default: 0.03
    min: 0.015
    max: 0.06
    unit: s
  char_duration:
    default: 0.6
    min: 0.3
    max: 1
    unit: s
  from:
    default: start
    options:
    - start
    - end
    - center
    - edges
    - random
  rise:
    default: 0.6
    min: -1
    max: 1.2
    unit: em
  rotate:
    default: 0
    min: -90
    max: 90
    unit: deg
  scale:
    default: 1
    min: 0
    max: 1.6
    unit: x
  blur:
    default: 8
    min: 0
    max: 24
    unit: px
related:
- type/mask-reveal
- type/tracking-in
- type/scramble
since: 0.5.0
---

## Behaviour

Each character arrives on its own: it rises, turns, scales and sharpens from a blur, with a short delay after the one before. The order can run from the start, the end, the centre, the edges or at random (seeded).

## Rules

- Only for display words of 12 characters or fewer; longer text reveals by line or word.
- Opacity leads: it is fully in by about half of each letter's time, while position keeps settling.
- Keep the stagger between 15 and 60 ms; the whole word should land within a second.
- Random order is seeded, so every render is identical.
