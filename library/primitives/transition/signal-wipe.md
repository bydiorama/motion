---
slug: transition/signal-wipe
kind: primitive
group: transition
summary: A glowing accent line sweeps across and leaves the next scene behind it.
status: specified
origin: designed
energy: medium
params:
  duration:
    default: 0.55
    min: 0.35
    max: 1.2
    unit: s
  direction:
    default: down
    options:
    - down
    - up
    - right
    - left
  glow:
    default: 1
    min: 0
    max: 2
    unit: ratio
  trail:
    default: 0.16
    min: 0
    max: 0.4
    unit: of the frame
  push:
    default: 0.04
    min: 0
    max: 0.1
    unit: ratio
related:
- transition/slant-wipe
- transition/cover-reveal
since: 0.5.0
---

## Behaviour

A thin line of accent light crosses the frame and leaves the next scene behind it, with a soft wash of the same light trailing on the revealed side. Both scenes stay still; only the edge moves. The outgoing scene grows a touch as it is covered. The line exists only while it crosses.

## Rules

- 0.4–0.7 s on an in-out curve; start and end the line just outside the frame so its glow is never cut at rest.
- Content stays still under the edge, so it reads as a cut drawn by light, not a slide.
- It spends the scene's accent: do not use another accent element in the same frames.
- Down for what comes next, sideways for a sibling.
