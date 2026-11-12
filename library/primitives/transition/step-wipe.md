---
slug: transition/step-wipe
kind: primitive
group: transition
summary: Stepped bars sweep across the frame.
status: draft
origin: observed
observations: 1
energy: medium
params:
  duration:
    default: 0.5
    min: 0.4
    max: 0.7
    unit: s
  steps:
    default: 6
    min: 4
    max: 10
    unit: bars
related:
- transition/curtain
since: 0.3.0
---

## Behaviour

Bars of the next scene enter one after another with a short stagger.

## Rules

- Bars follow one direction only.
