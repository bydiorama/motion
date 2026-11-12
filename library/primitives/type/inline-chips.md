---
slug: type/inline-chips
kind: primitive
group: type
summary: Icons sit inside a sentence as if they were words.
status: draft
origin: observed
observations: 1
energy: low
params:
  chip_height:
    default: 1.4
    min: 1.2
    max: 1.6
    unit: cap-height
related:
- type/word-build
since: 0.3.0
---

## Behaviour

Small icons or logos are set inline with the text and enter with the same motion as words.

## Rules

- At most five chips per line.
