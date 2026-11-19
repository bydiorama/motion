---
slug: type/word-build
kind: primitive
group: type
summary: Words rise and fade in one by one.
status: draft
origin: observed
observations: 1
energy: medium
params:
  rise:
    default: 16
    min: 12
    max: 20
    unit: px
  stagger:
    default: 0.1
    min: 0.08
    max: 0.12
    unit: s
  word_duration:
    default: 0.5
    min: 0.3
    max: 0.6
    unit: s
related:
- scene/kinetic-headline
since: 0.3.0
---

## Behaviour

Each word moves up a few pixels while fading in. The line is laid out whole from the first frame, so it never re-wraps or re-centres as words arrive.

## Rules

- Ease-out for every word.
