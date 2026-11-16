---
slug: style/brand-system
kind: style
summary: Calm grid, generous space. For identity presentations.
status: draft
origin: designed
tokens:
  beat: 3
surface:
  canvas: off-white
  texture: null
  accent_colours: 1
  typefaces: 1
uses:
- scene/specimen-grid
- scene/grid-wall
- fx/mosaic-fill
- fx/stagger-fill
- type/style-multiply
- transition/step-wipe
- scene/logo-reveal
- fx/path-draw
- fx/shape-morph
- fx/grid-ripple
- type/mask-reveal
- transition/cover-reveal
- rig/layer-stack
avoids:
- texture/dither
- transition/torn-edge
- type/scramble
formats:
- '16:9'
- '4:5'
duration:
  min: 40
  max: 90
  unit: s
since: 0.5.0
---

## Character

Everything sits on one grid and moves along it. Long holds, one colour change per beat, and the mark is the only thing that is ever centred.
