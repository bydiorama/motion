---
slug: transition/push
kind: primitive
group: transition
summary: The next scene pushes the current one out of frame, with parallax and motion blur.
status: specified
origin: observed
observations: 5
energy: high
params:
  duration:
    default: 0.7
    min: 0.3
    max: 1.2
    unit: s
  direction:
    default: left
    options:
    - left
    - right
    - up
    - down
  parallax:
    default: 0.35
    min: 0
    max: 1
    unit: ratio
  blur:
    default: 0.5
    min: 0
    max: 1
    unit: ratio
related:
- transition/slant-wipe
- transition/stack-over
since: 0.5.0
---

## Behaviour

The next scene pushes the current one out of frame. The outgoing scene travels less than the incoming one (parallax), dims a little, and both blur along the direction of travel at full speed.

## Rules

- Strong in-out curve over 0.5–0.9 s.
- Motion blur follows velocity and smears along the push only: none at rest, a half-frame shutter (`blur: 0.5`) at full speed. A round blur would soften edges that are not moving.
- Push in the direction of reading unless the story says otherwise.
