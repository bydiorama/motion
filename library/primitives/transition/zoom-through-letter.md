---
slug: transition/zoom-through-letter
kind: primitive
group: transition
summary: The camera flies through the opening of a letter.
status: specified
origin: observed
observations: 2
energy: high
params:
  duration:
    default: 0.6
    min: 0.5
    max: 0.8
    unit: s
related:
- transition/dive-in
since: 0.3.0
---

## Behaviour

The view scales into the counter of a large letter until the inside fills the frame and becomes the next background.

## Rules

- Choose letters with open counters: O, A, D, P.
