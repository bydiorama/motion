---
slug: transition/slant-wipe
kind: primitive
group: transition
summary: A slanted edge cuts across the frame, uncovering the next scene; the old one drifts back.
status: specified
origin: observed
observations: 3
energy: high
params:
  duration:
    default: 0.6
    min: 0.4
    max: 0.9
    unit: s
  slant:
    default: 20
    min: 0
    max: 40
    unit: '% of width'
  direction:
    default: left
    options:
    - left
    - right
  drift:
    default: 8
    min: 0
    max: 15
    unit: '% of width'
related:
- transition/push
- transition/step-wipe
since: 0.5.0
---

## Behaviour

A slanted edge cuts across the frame and uncovers the next scene, while the old one drifts back a little.

## Rules

- The edge starts and ends fully outside the frame so no corner lingers.
- Slant of 0–40% of the width; 15–25% reads as speed.
