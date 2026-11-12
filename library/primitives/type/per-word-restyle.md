---
slug: type/per-word-restyle
kind: primitive
group: type
summary: Each word changes to a new style in turn.
status: draft
origin: observed
observations: 1
energy: medium
params:
  change_interval:
    default: 1.0
    min: 0.7
    max: 1.5
    unit: s
related:
- ui/collab-cursors
since: 0.3.0
---

## Behaviour

A word is selected, then animates to a new weight, slant, size, tracking or highlight.

## Rules

- One change per beat.
- Show the selection before the change.
