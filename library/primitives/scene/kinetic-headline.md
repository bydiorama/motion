---
slug: scene/kinetic-headline
kind: primitive
group: scene
summary: A centred headline that builds while you read it.
status: specified
origin: observed
observations: 2
energy: medium
params:
  max_words:
    default: 8
    min: 3
    max: 10
    unit: words
  lines:
    default: 2
    min: 1
    max: 2
    unit: lines
related:
- type/word-build
- type/inline-chips
since: 0.3.0
---

## Behaviour

One or two centred lines appear piece by piece. The line re-centres as it grows.

## Rules

- Never more than `max_words` visible at once.
- One idea per headline.
