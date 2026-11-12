---
slug: type/writing-ticker
kind: primitive
group: type
summary: A sentence is typed while the line scrolls left.
status: draft
origin: observed
observations: 1
energy: medium
params:
  chars_per_s:
    default: 14
    min: 10
    max: 20
    unit: chars/s
related:
- type/per-word-restyle
since: 0.3.0
---

## Behaviour

The caret stays near the centre of the frame. Finished text leaves to the left.

## Rules

- Type size large enough that only 3 to 5 words are visible.
