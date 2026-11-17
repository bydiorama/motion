---
slug: scene/post-carousel
kind: primitive
group: scene
summary: Slides shown one at a time as a post or posters, turning past in depth.
status: draft
origin: observed
observations: 1
energy: medium
params:
  width:
    default: 54
    min: 20
    max: 100
    unit: '% of stage width'
  ratio:
    default: '4:5'
    options:
    - '4:5'
    - '1:1'
    - '9:16'
    - '3:4'
    - '16:9'
  chrome:
    default: post
    options:
    - post
    - none
  hold:
    default: 1.4
    min: 0.4
    max: 6
    unit: s
  turn:
    default: 0.8
    min: 0.3
    max: 2
    unit: s
  angle:
    default: 72
    min: 0
    max: 85
    unit: deg
  loop:
    default: false
related:
- rig/rolodex
- transition/push
- fx/slow-push
since: 0.5.0
---

## Behaviour

A set of slides presented one at a time: the pages of a social carousel post, or a series of posters. The slides stand side by side in one world. The one in front faces the camera; its neighbours stand beside it, turned away and hinged on the edge nearest the frame, so they read as narrow strips that promise more. Each step the whole row turns: the front slide swings out to one side as the next swings in from the other, and the one after takes its place as the new strip.

With `chrome: post`, a post's header (avatar and account name) and footer (actions, and dots that follow the slide in front) stay fixed above and below while the slides turn between them. With `chrome: none`, the slides are bare posters with rounded corners and a soft shadow; a stage that sets `--m-card-radius` and `--m-card-shadow` (an identity with square corners and no depth) gives them its own. With `angle: 0` the neighbours lie flat beside the frame and the row slides like a swiped carousel.

Pictures drift slowly inside their slide from the moment they start to arrive until they have gone.

## Rules

- A slide rests in front for at least 1.2 s, longer with text: one idea per slide.
- Turns ease in and out and take 0.6–1 s; every turn is the same length, so the steps feel like one rhythm.
- Neighbours turn 60–80° away: wide enough to show they are there, narrow enough not to compete.
- The frame of the post holds still; only the slides move. Nothing else on stage moves during a turn.
- For a loop, set `loop` and give three slides or more: the first waits beside the last and the film ends where it began.
- On a 4:5 or 9:16 stage the post takes about half the width, so both neighbours stay inside the frame. Full width and flat (`angle: 0`), the posts slide along the frame one after another: line up anything ruled in the posts with the stage's own rules.
