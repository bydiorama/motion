---
slug: ui/prompt-typing
kind: primitive
group: ui
summary: Text is typed into an input field.
status: specified
origin: observed
observations: 2
energy: low
params:
  chars_per_s:
    default: 32
    min: 25
    max: 40
    unit: chars/s
related:
- type/typed-title
- ui/cursor-click
since: 0.3.0
---

## Behaviour

Characters appear with slight timing variation, as if typed by a person.

## Rules

- Seeded jitter.
- Pause 0.3 s before sending.
