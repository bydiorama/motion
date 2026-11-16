---
slug: ui/page-scroll
kind: primitive
group: ui
summary: A page scrolls inside a window, resting on its sections, blurred only by its own speed.
status: specified
origin: designed
energy: medium
params:
  from:
    default: 0
    min: 0
    max: 100
    unit: '% of scroll'
  to:
    default: 100
    min: 0
    max: 100
    unit: '% of scroll'
  duration:
    default: 3
    min: 0.4
    max: 30
    unit: s
  rest:
    default: 0.4
    min: 0
    max: 3
    unit: s
  delay:
    default: 0
    min: 0
    max: 30
    unit: s
  shutter:
    default: 0.5
    min: 0
    max: 1
    unit: ratio
related:
- rig/browser-window
- ui/tour-hold
- scene/grid-wall
since: 0.5.0
---

## Behaviour

A page, taller than its window, travels upward behind it the way a visitor reads: it moves, rests on a section, moves again. The page is one tall capture or its sections stacked top to bottom. While it travels it smears along the scroll only; at each rest it is sharp.

## Rules

- Rest on whole sections: a headline with what belongs to it, never a line cut at the window's edge.
- A longer leg takes longer, by the square root of its length: four times the distance in twice the time.
- Each leg eases in and out. One or two rests in a scroll; more reads as hectic.
- Rests are 0.6–0.9 s, long enough to recognise a section; hold on the last one before anything else moves.
- The smear follows speed (see the craft rule on motion blur): none at a rest, most in the middle of a leg.
- Let the window nearly fill the frame while it scrolls, then pull back: the page becomes one object among others.
