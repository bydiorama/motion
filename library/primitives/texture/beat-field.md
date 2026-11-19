---
slug: texture/beat-field
kind: primitive
group: texture
summary: A quiet dot lattice whose light breathes on the beat, with a ring of light leaving the centre on each one.
status: specified
origin: designed
energy: low
params:
  pitch:
    default: 18
    min: 8
    max: 60
    unit: px
  dot:
    default: 0.33
    min: 0.1
    max: 0.5
    unit: ratio
  paper:
    default: 0.045
    min: 0
    max: 0.2
    unit: opacity
  glow:
    default: 0.13
    min: 0
    max: 0.4
    unit: opacity
  glow_radius:
    default: 320
    min: 80
    max: 1200
    unit: px
  decay:
    default: 3.2
    min: 0.5
    max: 8
    unit: per beat
  ring:
    default: 0.22
    min: 0
    max: 0.6
    unit: opacity
  ring_reach:
    default: 620
    min: 120
    max: 2000
    unit: px
  ring_life:
    default: 0.95
    min: 0.3
    max: 1
    unit: beats
  center_x:
    default: 50
    min: 0
    max: 100
    unit: '% of width'
  center_y:
    default: 50
    min: 0
    max: 100
    unit: '% of height'
  period:
    default: 0.5
    min: 0.2
    max: 2
    unit: s
related:
- texture/signal-field
- texture/vignette
since: 0.5.0
---

## Behaviour

A dot lattice laid on its centre, every dot faintly there (`paper`). A soft light at the centre lifts on every beat and dies away before the next (0.6 + 0.4·e^(−decay·phase)), and a thin ring of light leaves the centre on each beat, reaching `ring_reach` px as it fades, lighting only the dots it passes. The beat comes from the film's tempo, and the phase from the film's clock, so it lands on the music wherever the layer starts. Without a tempo, `period` is the beat. The bitmap is drawn at the camera's zoom, so a dive keeps the dots round and sharp.

## Rules

- It is the room's light, not the subject: the centre light stays under 0.15 and the ring under 0.25, with the marks on top at full strength.
- Lay the marks on the lattice: size them in whole pitches and put their centres on dots, so the field and the marks read as one screen. List them in `clear` to keep dots out from under them.
- Every layer that pulses shares one beat, so give the light the film's tempo rather than a `period` of its own. Marks that loop (spinners, progress) offset their own phases instead: see CRAFT §12.
- On a camera dive the bitmap grows with the zoom up to 8192 px a side; past that the dots soften slightly. Frame the deepest zoom inside that.
