---
slug: style/dark-showcase
kind: style
summary: Cinematic, dense, confident. For launches of platforms and multi-tool products.
status: draft
origin: designed
tokens:
  beat: 2.0
surface:
  canvas: black
  texture: null
uses:
- scene/hero-object
- rig/tumbling-object
- transition/dive-in
- fx/radial-burst
- transition/beat-cut
- scene/mosaic
- type/char-cascade
- transition/iris
- transition/stack-over
- texture/grain
- texture/signal-field
- type/fill-text
- transition/camera-travel
- transition/whip-pan
- transition/signal-wipe
- transition/fly-past
- fx/pin-drop
avoids:
- texture/halftone-field
formats:
- '16:9'
- '4:5'
duration:
  min: 35
  max: 50
  unit: s
since: 0.3.0
---

## Character

Bursts and dives carry the energy at the start and end. The product tour in the middle uses hard cuts inside a fixed layout.

Depth is real: where a hand-over is a camera move, both scenes live in one world and only the camera moves; motion blur follows speed and smears along the path only. Accent light (a signal line, a marker's glow) marks the one thing that matters in a frame.
