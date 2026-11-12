---
slug: type/scramble
kind: primitive
group: type
summary: Characters cycle randomly before settling.
status: draft
origin: observed
observations: 1
energy: medium
params:
  duration:
    default: 0.8
    min: 0.6
    max: 1.0
    unit: s
related: []
since: 0.3.0
---

## Behaviour

Each character flips through random glyphs and locks from left to right.

## Rules

- Use a seeded random so renders are repeatable.
