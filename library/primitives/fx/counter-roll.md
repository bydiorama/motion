---
slug: fx/counter-roll
kind: primitive
group: fx
summary: A number rolls up to its value.
status: draft
origin: observed
observations: 1
energy: medium
params:
  duration:
    default: 1.0
    min: 0.6
    max: 1.5
    unit: s
related:
- type/accent-number
since: 0.3.0
---

## Behaviour

Digits roll like counters and settle with ease-out.

## Rules

- End on the exact value; never show a wrong final digit.
