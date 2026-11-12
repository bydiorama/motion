---
slug: texture/halftone-field
kind: primitive
group: texture
summary: Squares or dots sized by a gradient.
status: draft
origin: observed
observations: 1
energy: low
params:
  cell:
    default: 12
    min: 8
    max: 20
    unit: px
related: []
since: 0.3.0
---

## Behaviour

A grid of shapes whose size follows a gradient. The field can grow from an edge.

## Rules

- Accent colour plus one grey.
