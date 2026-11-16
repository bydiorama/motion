---
slug: style/product-ui
kind: style
summary: Interface up close, led by the cursor. For app demos.
status: draft
origin: designed
tokens:
  beat: 2.5
surface:
  canvas: white
  texture: null
  accent_colours: 1
  typefaces: 1
uses:
- scene/zoomed-ui
- ui/cursor-click
- ui/prompt-typing
- ui/tour-hold
- ui/streamed-result
- transition/blur-dissolve
- type/shimmer
- transition/stack-over
- transition/push
- fx/odometer
- rig/browser-window
- transition/camera-travel
avoids:
- texture/ascii
- transition/torn-edge
- rig/orbit-ring
formats:
- '16:9'
- '9:16'
duration:
  min: 30
  max: 60
  unit: s
since: 0.5.0
---

## Character

The interface is the hero, enlarged until its text is readable. The camera follows the cursor; nothing moves that the person using the app would not see move.
