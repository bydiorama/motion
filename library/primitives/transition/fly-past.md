---
slug: transition/fly-past
kind: primitive
group: transition
summary: The layers of a scene fly out past the camera, front first, revealing the next beneath.
status: specified
origin: designed
energy: high
params:
  duration:
    default: 1.1
    min: 0.6
    max: 1.8
    unit: s
  spread:
    default: 0.35
    min: 0
    max: 0.6
    unit: ratio
  tumble:
    default: 50
    min: 0
    max: 80
    unit: deg
  defocus:
    default: 4
    min: 0
    max: 10
    unit: px
  settle:
    default: 0.05
    min: 0
    max: 0.12
    unit: ratio
related:
- transition/dive-in
- fx/depth-drift
since: 0.5.0
---

## Behaviour

The outgoing scene comes apart: each of its layers flies towards the camera and past it, front layer first, tumbling away from the centre of the frame and going out of focus as it nears the lens. The next scene is already beneath them and settles from a touch closer as they clear.

## Rules

- For scenes made of a few separate panels, tiles or cards. A single full-frame layer has nothing to come apart.
- Front first, 0.06–0.1 s apart; each layer accelerates (no ease-out on a thing leaving past the lens).
- Each layer leaves along the line from the frame centre through its own centre, so they part like a crowd.
- Defocus grows with nearness: blur only in the last half of a layer's flight.
