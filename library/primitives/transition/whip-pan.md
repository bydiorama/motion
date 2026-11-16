---
slug: transition/whip-pan
kind: primitive
group: transition
summary: The camera whips to the next scene with a streak along the pan only, then brakes.
status: specified
origin: designed
energy: high
params:
  duration:
    default: 0.5
    min: 0.3
    max: 0.9
    unit: s
  direction:
    default: left
    options:
    - left
    - right
    - up
    - down
  anticipation:
    default: 0.03
    min: 0
    max: 0.08
    unit: of the frame
  shutter:
    default: 0.5
    min: 0
    max: 1
    unit: ratio
related:
- transition/push
- transition/slant-wipe
since: 0.5.0
---

## Behaviour

The camera gathers for an instant against the pan, then whips to the next scene laid beside the current one and brakes hard on it. The smear is along the pan only, strongest at the seam between the scenes, so the seam is never seen.

## Rules

- 0.4–0.6 s. Nearly all the travel happens in the middle third.
- Anticipation: pull back 2–5% of the frame for about 0.15 s first.
- Blur along the motion only, sized by speed: a round blur reads as out of focus, not as speed.
- At most twice in a film, between scenes of equal weight.
