---
slug: style/clean-explainer
kind: style
summary: Bright, precise, product-first. For feature announcements.
status: draft
origin: designed
tokens:
  beat: 2.5
surface:
  canvas: white
  texture: texture/halftone-field
  accent_colours: 1
  typefaces: 1
uses:
- scene/kinetic-headline
- scene/stat-with-evidence
- scene/zoomed-ui
- type/word-build
- transition/blur-dissolve
- fx/marquee-highlight
- type/mask-reveal
- type/scribble-highlight
- scene/bar-chart
- scene/line-chart
- fx/odometer
- transition/push
avoids:
- transition/torn-edge
- texture/dither
formats:
- '16:9'
- '1:1'
duration:
  min: 18
  max: 25
  unit: s
since: 0.3.0
---

## Character

Ease-out entrances, word-by-word text, enlarged product UI. Nothing on screen that is not about the message.
