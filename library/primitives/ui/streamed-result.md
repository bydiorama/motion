---
slug: ui/streamed-result
kind: primitive
group: ui
summary: An answer appears row by row.
status: specified
origin: observed
observations: 2
energy: medium
params:
  row_stagger:
    default: 0.08
    min: 0.05
    max: 0.12
    unit: s
related:
- fx/stagger-fill
since: 0.3.0
---

## Behaviour

Placeholder shapes appear first and are replaced by content.
