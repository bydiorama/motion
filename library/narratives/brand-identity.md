---
slug: narrative/brand-identity
kind: narrative
family: brand
summary: Presents a new identity, from mark and idea to type, colour and use.
status: draft
origin: designed
duration:
  min: 40
  max: 90
  unit: s
fits_styles:
- style/brand-system
- style/editorial-type
beats:
- name: mark
  share: 14
  content: The mark assembles from its parts
  primitives:
  - scene/logo-reveal
  - fx/path-draw
  - scene/hero-object
  - fx/letter-interleave
- name: idea
  share: 14
  content: The idea behind it, in one sentence
  primitives:
  - type/mask-reveal
  - scene/kinetic-headline
  - type/word-build
- name: type
  share: 16
  content: The typeface, set large and in its weights
  primitives:
  - type/tracking-in
  - scene/specimen-grid
  - type/style-multiply
- name: colour
  share: 14
  content: The palette fills the frame
  primitives:
  - transition/cover-reveal
  - fx/mosaic-fill
  - transition/light-dark-flip
- name: system
  share: 16
  content: Grid, shapes and patterns drawn from the mark
  primitives:
  - fx/shape-morph
  - fx/grid-ripple
  - scene/grid-wall
  - fx/card-arrangements
- name: applications
  share: 16
  content: The identity on the surfaces it will live on
  primitives:
  - scene/mosaic
  - rig/rolodex
- name: end
  share: 10
  content: The lockup, still
  primitives:
  - scene/logo-reveal
  - transition/collapse-to-anchor
  - scene/end-card
since: 0.5.0
---

## Notes

Slow enough to study. Each beat shows one part of the system, and the parts are built from the mark rather than added to it.

The mark is revealed by one of a few patterns: stroke then fill, construction geometry, a mask opened from the mark's own shape, a morph from a simple shape, assembly on a grid, or symbol then wordmark. Pick one and keep it; the end lockup repeats it in short. A slow drift runs under every hold, so the mark is never dead still.

Shares are percentages of total duration and must add up to 100.
