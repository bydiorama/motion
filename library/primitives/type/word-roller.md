---
slug: type/word-roller
kind: primitive
group: type
summary: Words roll vertically in a slot.
status: draft
origin: observed
observations: 1
energy: medium
params:
  per_word:
    default: 0.4
    min: 0.3
    max: 0.6
    unit: s
related: []
since: 0.3.0
---

## Behaviour

One word in a sentence is replaced by the next from a list, rolling up or down.
