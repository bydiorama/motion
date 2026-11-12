---
slug: scene/specimen-grid
kind: primitive
group: scene
summary: The same word or glyph shown in many styles at once.
status: specified
origin: observed
observations: 2
energy: medium
params:
  cells:
    default: 12
    min: 6
    max: 24
    unit: cells
related:
- type/style-multiply
since: 0.3.0
---

## Behaviour

A grid of variations of one item. One cell is highlighted as the current choice.

## Rules

- All cells share one baseline grid.
- Exactly one highlight.
