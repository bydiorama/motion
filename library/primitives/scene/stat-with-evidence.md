---
slug: scene/stat-with-evidence
kind: primitive
group: scene
summary: A big number with supporting thumbnails floating around it.
status: draft
origin: observed
observations: 1
energy: medium
params:
  evidence_items:
    default: 10
    min: 6
    max: 16
    unit: items
  planes:
    default: 3
    min: 2
    max: 3
    unit: planes
related:
- type/accent-number
- fx/depth-drift
since: 0.3.0
---

## Behaviour

The number sits in the centre in the accent colour. Small pieces of evidence drift around it on several depth planes.

## Rules

- The number is readable in the first 0.5 s.
- Evidence never overlaps the number.
