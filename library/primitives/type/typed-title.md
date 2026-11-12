---
slug: type/typed-title
kind: primitive
group: type
summary: Characters appear one by one with a caret.
status: specified
origin: observed
observations: 2
energy: low
params:
  chars_per_s:
    default: 20
    min: 12
    max: 30
    unit: chars/s
related:
- ui/prompt-typing
since: 0.3.0
---

## Behaviour

Text is typed out. The caret blinks when typing pauses.

## Rules

- Caret blink rate 1 Hz.
