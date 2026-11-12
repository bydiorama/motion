---
slug: fx/letter-interleave
kind: primitive
group: fx
summary: Letters of a word alternate with pictures in one grid.
status: draft
origin: observed
observations: 1
energy: medium
params:
  cell_stagger:
    default: 0.05
    min: 0.03
    max: 0.08
    unit: s
related: []
since: 0.3.0
---

## Behaviour

Letters and small illustrations share cells of the same size, so the word stays readable between the pictures.

## Rules

- Short words only: 4 to 7 letters.
