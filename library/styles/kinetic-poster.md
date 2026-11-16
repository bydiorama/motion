---
slug: style/kinetic-poster
kind: style
summary: A single poster frame that moves. For social and outdoor screens.
status: draft
origin: designed
tokens:
  beat: 1.5
surface:
  canvas: one brand colour, cut with the inverse
  texture: texture/grain
  accent_colours: 1
  typefaces: 1
uses:
- type/block-reveal
- type/char-cascade
- type/mask-reveal
- type/echo
- type/parting
- type/word-roller
- transition/slant-wipe
- transition/cover-reveal
- transition/curtain
- transition/step-wipe
- transition/torn-edge
- texture/grain
- scene/post-carousel
avoids:
- transition/blur-dissolve
- fx/depth-drift
- rig/orbit-ring
- texture/gradient-drift
formats:
- '4:5'
- '9:16'
duration:
  min: 6
  max: 10
  unit: s
since: 0.3.0
---

## Character

A poster that moves. One idea, set as large as the frame allows, in a heavy grotesque or a condensed face; two colours, the brand colour and its inverse, swapped hard on the beat. Type is uncovered rather than faded: masks, blocks and slanted wipes, never a dissolve.

## Rules

- The headline fills 70–90% of the frame width; nothing else on screen is bigger than a caption.
- Per-letter moves only on display words of 12 characters or fewer; longer lines go by line or word.
- Every cut lands on a beat, every 0.5–1.5 s; colour swaps are hard cuts, not crossfades.
- Keep type inside the safe area: 5% in 16:9; in 9:16, x 60–940 and y 250–1500 of 1080×1920.
- One hero move per scene; the rest of the frame holds still.
- Loops end on the frame they began on, so a 6–10 s piece plays forever.
