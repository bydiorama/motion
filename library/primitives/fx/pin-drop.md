---
slug: fx/pin-drop
kind: primitive
group: fx
summary: Markers land on places one by one, ripple together, and raise their labels on stems.
status: specified
origin: designed
energy: medium
params:
  stagger:
    default: 0.28
    min: 0.1
    max: 0.6
    unit: s
  stem:
    default: 120
    min: 0
    max: 260
    unit: px
  size:
    default: 16
    min: 8
    max: 32
    unit: px
  ripple:
    default: 1.3
    min: 0.8
    max: 2.4
    unit: s
  glow:
    default: 1
    min: 0
    max: 2
    unit: ratio
related:
- fx/grid-ripple
- scene/stat-with-evidence
since: 0.5.0
---

## Behaviour

Places light up one after another. On each, a marker lands with a small overshoot over a soft glow; a ripple spreads from it; then a stem grows out of the marker and carries the place's label up into a card that stands centred over it. All ripples share one phase, so they are the same size at every instant and pulse together.

## Rules

- Markers face the viewer and are drawn at one size, wherever they sit. Never let depth or position scale them.
- One ripple phase for all. Ripples on their own clocks read as noise.
- Land first, then grow: the card leaves 0.15–0.2 s after its marker lands.
- Each card stands over its own place, not wherever there is room: if two would overlap, move the places' order or the stem height, not the cards.
- Three to five places per frame; more becomes a chart.
