# Craft

What separates motion that looks designed from motion that looks generated is mostly numbers: which curve, how long, how far, in what order. This page collects the numbers. Each rule can be checked against a film or a contact sheet. Library entries cite these rules; films should follow them unless a brief says otherwise.

Everything here describes patterns, not sources.

## 1. Easing

A film uses **at most four curves plus one signature curve**. More than that and nothing feels related.

| Job | Name in the catalog | Curve | Use it for |
| --- | --- | --- | --- |
| Arrive | `expressive.out` | (0.05, 0.7, 0.1, 1) | Most entrances. Arrives in the first fifth, then glides. |
| Leave | `expressive.in` | (0.3, 0, 0.8, 0.15) | Exits. Gathers, then goes. |
| Hand over | `quint.inOut` | (0.83, 0, 0.17, 1) | Pushes, wipes, scene-to-scene moves. |
| Land hard | `snap.out` | (0.3, 0.9, 0.1, 1) | Words that land after a block or a cut. |
| Workhorse | `ui.spring` | (0.22, 1, 0.36, 1) | Small UI moves and supporting text. |
| Wind up | `anticipate.in` | (0.45, −0.48, 1, −0.82) | Before a whip or a throw. Pulls back, then goes. |
| Overshoot | `back.out` or a bezier (0.34, Y, 0.64, 1) | Y from 1.3 to 1.56 | Icons, chips and marks that pop. |
| Drift | `linear` | | Container drift, loops, marquees, rotation. |

- **Entrances ease out, exits ease in, moves on screen ease in-out.** A move that both starts and ends on screen never uses an ease-out alone.
- **Opacity never overshoots.** Only position, scale and rotation do.
- **Two clocks.** An eased move for the element, and a slow linear drift on its container that keeps going through the hold. The eye reads the first as action and the second as life.
- **Polynomials, not lookalikes.** When a curve has a name in the catalog, use the name: it is solved exactly.
- **Many equal steps, one sine.** When one move passes through several equal steps (an accordion sliding card to card, a list scrolling item to item), ease it with `sine.inOut`. A cubic in-out's top speed is 3× its average, so the middle steps flash by; a sine's is 1.57×.
- **A push that lands on the next scene eases in and out.** Accelerating into the cut (`dive-in` at its default pace) is a hit; when the point you dive into continues as the next scene, use `pace: glide`, which arrives at rest.

### Springs

Write a spring as `{ "spring": { "duration": d, "bounce": b } }`. The runtime lengthens the move so the overshoot settles.

| Preset | duration | bounce | Feel |
| --- | --- | --- | --- |
| settle | 0.8 | 0 | Critically damped, no overshoot. |
| glide | 0.9 | 0.1 | A trace of give. |
| pop | 0.6 | 0.25 | Marks, buttons, stickers. The `pop` move uses 0.5 / 0.35. |
| playful | 0.7 | 0.4 | Social, consumer. One per film. |
| heavy | 1.2 | 0.05 | Large objects, cameras. |

Tie bounce to impact: a harder hit wobbles more and faster.

## 2. Rhythm

A film feels designed when it keeps one pulse: like moves take like time, rests are even, and the seams between sections are short against the sections. It feels generated when a swap takes 0.6 s here and 1 s there, a picture rests 1.2 s in one scene and 3 s in the next, or a transition lasts as long as what it joins. `motion pace` measures all of this; the numbers below are what it checks.

**Tempo.**

- **Set one tempo and count in beats.** `"tempo": {"bpm": 120}`, then every time is beats or bars (`"2b"`, `"1bar"`). A beat is 60 / bpm seconds. Change the bpm and the whole film retimes in proportion.
- **A beat is a whole number of frames**: fps × 60 / bpm is an integer. At 60 fps: 100, 120, 144, 150 bpm; at 30: 100, 120, 150; at 25: 100, 125, 150.
- **Choose the tempo by feel, or by the music.** Calm and editorial: 80–100. Most identity and product films: 110–130. Social and energetic: 130–150. Faster than about 160, changes come every 0.4 s and nothing reads. A film cut to a genre takes its range: jazz runs from ballads (60–80) through medium swing (120–150) to bebop (over 200).
- **Bars and phrases.** 4 beats a bar, 4 bars a phrase. Hand-overs land on the first beat of a bar, and a section lasts whole bars cut to cut; a plain cut inside a section lands on any beat. Smaller moves land on the beat or the half-beat, and last whole half-beats. At 120 bpm: a beat 0.5 s, a bar 2 s, a phrase 8 s; a 16 s loop is 8 bars.

**Like moves take like time.**

- **One length per kind of move**, whatever primitive draws it: every hand-over one length, every picture change (swap, shift, turn) one length, every rest one length. Lengths of one kind differ by at most a third.
- **A ladder in beats.** Hand-over 1 beat (2 for a featured turn of the story, once or twice a film). Picture change 1–2 beats. Rest between changes 2–4 beats, never under 1 s. Opening and closing holds 1–2 beats each, 0.8–1.2 s across the loop seam.
- **Even density.** How much of the frame changes a second stays within 2× from scene to scene. A change counts by its share of the frame: a whole picture counts one, a tile a fifth of the frame counts a fifth. A wall of tiles swaps one tile at a time, in turn, while the others rest; several tiles at once in one scene, then one picture every three seconds in the next, reads as a lurch.
- **Vary on purpose only**, at a phrase boundary: an accelerando into a reveal, halving each time (8 → 4 → 2 → 1 beats) and then holding at least 8; a longer hold, 1.5–2×, on the end card.

**Cut, mostly.**

- **One picture to a frame, and cut between them.** A film of single pictures, each filling the frame, cut on the beat, reads as edited; a wall of small pictures, or a transition at every seam, reads as a template. Use a wall to establish, then cut.
- **Alternate long and short.** A sweeping shot (a pan, a feed, a camera move) runs about twice as long as the quick shots around it: 4 beats against 2 at 100 bpm. Two or three quick shots between long ones give the eye a rest before each burst. Five shots in a row of one length tick like a metronome.
- **Quick shots: 1.2–1.4 s; long shots: 2–2.5 s.** Under 1.2 s, a picture is seen but not read.
- **Transitions only at the turns.** A signature wipe into the run of cuts and out of it, plain cuts in between. Change the frame colour on every framed shot, in the palette's order, so even plain cuts feel deliberate.

**Seams, not sections.**

- **A hand-over is at most a quarter of the shorter scene it joins** (a third is the ceiling). A 0.5 s dissolve between two 2 s pictures already feels enormous.
- **Each scene has time alone**, with no hand-over on screen, at least twice its longest hand-over. Two loud transitions either side of a short scene leave nothing of the scene.
- **Inside a scene of changing pictures, a hand-over is at most half of one picture's time** (rest + change). The eye counts pictures, not scenes: a 1.1 s sweep beside 1.2 s rests is felt as one more picture.
- **The cut sits in the middle of the hand-over.** Half of it belongs to each scene, so a scene's length cut to cut runs from the middle of one hand-over to the middle of the next.

**Held, not moving.**

- **About a third of a film is in motion**, two thirds held or drifting. Over 60% in motion, nothing reads; under 20%, with nothing drifting either, it waits. Drift (a slow push, a pan) keeps a held picture alive without counting as a move. A wall of tiles on their own clocks counts as its busiest tile.
- **A picture needs time.** Its gist registers in a tenth of a second, but it is remembered after 1–2 s: rest a full-frame picture at least 1 s plus 0.3 s per thing to see in it; a poster or key visual in a social cut 1.5–2 s; the end card 2.5–3 s.

**Story before rhythm.** Rhythm serves the story, not the other way round. Each scene answers one question and leads to the next by "therefore" or "but", never "and then". An identity film goes from the system (the device, then its colours and type) to its applications, from small to large, into the world, and back to the mark. A series of posts or posters is shown in one format per section (one after another, a feed, a carousel, a grid that builds), never mixed within a phrase.

## 3. Duration

The video scale is longer than an interface's, because nobody is waiting on it.

| Step | Seconds | For |
| --- | --- | --- |
| cut | 0.1 | A hard swap, a flash. |
| quick | 0.2 | Small UI responses, presses. |
| short | 0.33 | Chips, icons, supporting moves. |
| base | 0.5 | Words, small blocks. |
| long | 0.8 | Lines of text, panels, transitions. |
| hero | 1.2 | The one big move in a scene. |
| slow | 2.0 | Logo builds, line charts, morphs. |
| drift | 3–8 | Ambient: camera creep, gradients, loops. |

- **Exits take 60–75% of their entrance**, and an exit is never the entrance played backwards.
- **Text holds still** for at least the longer of 1.2 s and 0.3 s per word + 1 s.
- **Beats.** Product films cut every 1.5–4 s. A word or image swap holds about 0.7 s and moves about 0.4 s. A fast index list steps every 0.5 s. On a tempo, round each to the nearest half-beat (see Rhythm).

## 4. Stagger and order

- **Forward order in, backward order out.**
- **Set the spread, not the gap**, when the count can change: a whole grid of any size grows in within about 1 s.
- **On a grid, stagger by distance** from an origin (centre, edges, a corner, a chosen cell), not by index. `fx/grid-ripple` and the `from` param of the type primitives do this.
- **Random order is seeded.** Same film, same frames.
- Words 80–150 ms apart, lines 60–120 ms, letters 15–60 ms, tiles 20–100 ms.

## 5. Text

- **Masks over fades.** Text is uncovered: it rises through its own edge (`type/mask-reveal`, `mask-up`), a block passes over it (`type/block-reveal`), or a clip opens on it (`wipe-*`). A plain fade is for supporting text only.
- **Reveal by line or word.** Per-letter motion only for display words of 12 characters or fewer (`type/char-cascade`, `type/echo`).
- **Line masks travel 100–110%** of the line's height in 0.6–0.9 s, 60–120 ms between lines.
- **Opacity leads, transform follows.** When something fades and moves, the fade is complete by half the move.
- **A blur that sharpens** reads as focus; keep it under 24 px and gone by the end of the move.
- **Velocity-only trails.** Motion blur and echoes appear while something is moving fast and are gone when it stops: blur ≈ velocity × half a frame.
- **The first frame is a thumbnail.** Feeds show it as the cover. A headline that is already there, dim, and fills word by word (`type/fill-text`) reads at frame 0 and still has a reveal.
- **A headline over a montage arrives whole.** Reveal all its lines in one move, then let the pictures cut on beneath it. Landing one line per cut makes the sentence wait for the edit and reads as slow; the cuts are the rhythm, the headline is what holds still.
- **Mark after landing.** Underlines, circles and highlights draw after the line has settled (`type/scribble-highlight`).

## 6. Composition

- **A film has an anchor, and the best anchor is the world itself.** Keep one place the eye returns to: a floor that never moves, a slot where the subject will stand, marked from the first frame and filled later. One continuous drawing on one fixed view (no cuts, the camera still) anchors better than chrome repeated over cut scenes; a crosshair, an orbit and four corner labels around every frame read as decoration, and were rejected in review. Keep the corners to the headline and the mark.
- **One hero move per scene.** Everything else enters quietly or holds.
- **One accent per scene.** The accent colour marks the one thing that matters.
- **Safe areas.** In 16:9, keep text 5% inside every edge. In 9:16 (1080 × 1920), keep text within x 60–940 and y 250–1500: interface chrome covers the rest.
- **Nothing is dead still.** Under every hold, a slow drift: scale 1.03 → 1 over the scene, or a few degrees of rotation, on a linear curve.
- **A still photograph drifts inside its frame** (`fx/slow-push`): 4–14% of scale over the time it can be seen, linear, the frame's edge fixed. In a row of pictures, one direction. In a cut of single pictures, the push belongs to the shot: 4–8% on `sine.inOut`, with its focus on the subject.
- **Choose the shot by the picture.** Before choosing, make a contact sheet of every picture with the frame's crop drawn on it. A photograph survives the crop: fill the frame (`fx/slow-push`, focus on the subject). A picture full of lettering does not: frame it at its own ratio across the full width, on a field of the identity's colour, and let it rise into its slot (`slot-up`, about 48 px in half a beat). A picture much wider than the frame: let the camera travel along it (`fx/pan-across`). Never crop through a word.
- **Show a page whole before it becomes an object.** A site reads as a site when it nearly fills the frame and scrolls (`ui/page-scroll`): one or two rests on whole sections, 0.6–0.9 s each, a hold on the last one, and long legs slower than you think: a scroll that covers several screens wants about 2 s. Only then pull back to the wall, the device or the perspective.
- **A wall keeps moving.** Once a grid of cards is open, neighbouring columns drift in opposite directions, 60–90 px over the hold, and the wall stays on screen for at least 1.5 s after the last card has landed.

## 7. Depth and camera

What makes 3D look shot rather than assembled.

- **One world per hand-over.** When one scene hands to the next by a camera move, both live in one world and only the camera moves (`transition/camera-travel`). Two layers animated separately for one transition read as two unrelated moves.
- **Motion blur follows the path.** Blur only along the direction of travel, sized by on-screen speed: deviation = speed (px per frame) × shutter ÷ √12, with a half-frame shutter (0.5) as the film standard. A round blur reads as out of focus, not as speed. Set `"motionBlur": true` on any layer that travels far and fast; transitions that move whole scenes do this themselves.
- **Blur only while moving.** A camera move's blur rises and falls with its speed: peak in the middle, none at either end.
- **One camera vocabulary.** The 3D rigs (`rig/browser-window`, `rig/tab-stack`, `rig/layer-stack`) share one camera: `path` (`in`, `out`, `in-out`, `hold`), `tilt`, `pitch`, `roll`, `zoom`, where it looks (`pan_x`, `pan_y`), `move`, `ease` and `drift`. Land at an angle so depth reads (tilt 15–30°, pitch 8–15°, roll under 3°), then turn square-on while the content does its work: `path: out`. Zoom is a distance, never a scale, so perspective stays true.
- **Lifts stack.** A part lifted off a page rides on the plane below it, so the order never inverts however far the lower one moves. Its shadow scales with its height: a part lying flush casts nothing.
- **Never change state in one frame.** When something switches look (closed to open, one picture to the next), cross-fade the two over 0.2–0.4 s. Dissolve straight from one to the other; never dip through an empty state.
- **Same size means same size on screen.** Markers on a tilted plane are scaled against their depth, or turned to face the camera, so near ones are not drawn bigger. Use a long lens for things standing on a plane: stems stay vertical and parallel.
- **A route of stations keeps an even, unhurried pace.** When the camera visits a row of like stations, every leg takes the same time (about 1.1–1.3 s for a frame's height of travel) on `cubic.inOut`, with a rest of about 0.5 s at each. Shortening the legs to build pace, or a steeper curve such as `quart.inOut`, reads as hectic by the third station. A station never shows in the frame of the one before it.
- **Or the route flows.** The same route as one flowing move: every leg takes the same time (about 1.4 s for a frame's height) on a curve that leaves and arrives with no jolt (velocity as sin²), and the camera rests at each station for only a fraction of a second, 0.25–0.3 s. Passing the stations without stopping (slowing to about 0.4 of the mean speed) also works, but a brief rest lets each one register. Sideways sway turns round at the stations, so it eases through them on a cosine. Labels start 0.4–0.5 s before the station is centred, so they have landed by the time it is.
- **Many become one by landing, not by fading.** When several things are shown to be one (`rig/layer-stack`), they travel onto a base that never moves, lowest first, 0.1–0.2 s apart; each dissolves into what it lands on, and the accent arrives once, when the last has landed. Labels in a turned world face the camera and stay level.
- **A pan never strobes.** At its fastest, a picture crosses at most a fortieth of the frame's shorter side a frame (27 px at 1080 wide); at 30 fps that is half the speed it may take at 60. `fx/pan-across` reports its speed and `pace` warns (`judder`).
- **Shared rhythm.** A family of pulses (ripples, glows) shares one phase, so they are the same size at every instant.
- **Open from black.** A dark film fades in its first texture over 0.6–0.8 s before anything settles; the type starts with it.

## 8. Transitions

| Transition | Length | When |
| --- | --- | --- |
| `transition/beat-cut` | 0 | On the beat, between scenes that share a layout. |
| `transition/push` | 0.5–0.9 s | Sequential steps; push in reading direction. |
| `transition/slant-wipe` | 0.4–0.9 s | Energetic sequences, posters. |
| `transition/cover-reveal` | 0.6–1.6 s | Chapter breaks; panels in accent and inverse. |
| `transition/curtain` | 0.5–1.4 s | Formal breaks, title cards. |
| `transition/stack-over` | 0.4–1.2 s | One screen after another, as cards. |
| `transition/iris` | 0.4–1.4 s | From a point the eye is already on. |
| `transition/dive-in` | 0.4–0.9 s | Into a detail: a letter, a button, a dot. |
| `transition/blur-dissolve` | 0.4–0.8 s | Quiet changes of subject; at most once a film. |
| `transition/camera-travel` | 1.2–1.8 s | To what lies beside or below: the next page, the next section. |
| `transition/whip-pan` | 0.4–0.6 s | Between siblings of equal weight; at most twice a film. |
| `transition/signal-wipe` | 0.4–0.7 s | A cut drawn by accent light; for dark films. |
| `transition/fly-past` | 0.8–1.4 s | Out of a scene made of panels or tiles, to what lies beneath. |
| `transition/band-sweep` | 0.6–1.1 s | Turns of the story in an identity film; bands in the identity's own colours. One or two beats, within half a picture's time. |
| `transition/strip-wipe` | 0.6–1 s | An identity built on a ruled grid: its rows run across in colour. `cover` with `alternate` for a signature wipe into and out of a run of cuts. |

- **Content stays still while the edge moves** in a wipe, so it reads as a cut, not a slide.
- **Swap only while covered.** A cover or curtain changes the scene while the frame is fully covered.
- **Anticipation before speed.** A whip or a throw pulls back 3–5° for about 0.15 s first.
- **Changes between logo states are hard cuts**, not crossfades.

- **The signature transition comes from the identity.** Take its own shape, a ruled row, a band, a cut corner, and make it the wipe; a stock transition says nothing about whose film it is.

**From identity to motion.** Before choosing a single move, read the identity for:

1. **Its grid.** The unit the layouts are built on (a ruled row, a column, a module). Text, marks and wipes sit on it: a 1920 px tall frame of 8 rows has a row every 240 px.
2. **Its signature shape.** The device a viewer would recognise without the logo. It becomes the transition and the way things arrive.
3. **Its mark's structure.** How the logo is built (lines of type, a symbol and a word, a monogram). It builds in that order, each part from its own space.
4. **Its colours.** Measured from the designs, not guessed. They become the frame colours behind framed pictures and the colour of the wipe, in a fixed order.
5. **Its curves.** Arrivals fast then slow (`cubic.out`), cameras starting and settling (`sine.inOut`), wipes symmetric (`cubic.inOut`). Nothing moves at a constant speed except drift.

## 9. Logo reveals

Pick one pattern for a film and repeat it, short, at the end.

- **Stroke, then fill.** The outline draws at an even speed (`fx/path-draw`), then the fill fades in.
- **Construction.** Guide circles and lines draw first; the mark is built on them.
- **Mask from the mark.** The mark's own shape opens as an aperture on the next scene.
- **Morph.** A simple shape becomes the mark (`fx/shape-morph`).
- **Grid assembly.** Parts arrive cell by cell, by distance.
- **Slice shift.** The mark is cut into bands that slide into register.
- **Symbol, then wordmark.** The symbol lands centred; the lockup glides and the name slides out from behind it (`scene/logo-reveal`).
- **Wordmark rise.** The name rises through a mask, letter or line at a time.
- **Convergence.** Parts fly in from outside and meet.
- **Container collapse.** A full-frame shape shrinks into the mark.
- **Beat pulse.** The mark scales on the beat, once.
- **Glint.** A band of light passes over the finished mark (`type/shimmer` on the name).

## 10. End cards

- The logo is settled by 1.0–1.5 s into the card and holds for at least 1.5 s.
- In 16:9 the lockup is 25–35% of the frame width.
- Three elements at most: mark, name, one line (a call to action, a date or a URL).
- The poster frame is the end card at rest.

## 11. Data

- **Stage it:** axes, then data, then labels, then the one annotation that carries the point. Each stage 0.6–1.0 s.
- **A counter uses the same curve as its bars**, so they land together.
- **Line charts draw at a steady pace in x**, so the axis reads as time.
- **One highlight.** One bar or point in the accent; the rest muted.
- Never more than one number moving at a time.

## 12. Loops

- The last frame equals the first. Rotate roles or slots so the state after one period matches the start.
- Duplicate lists and wrap them, rather than resetting.
- Desynchronise a family of moves by phase offsets, not by fresh randomness.
- Loop lengths are whole bars at the film's tempo.
- **Close on the ground you opened on.** An identity loop can start and end on the system's bare device (a ruled grid, a field, a mark) with one small element resting on it. Let that element leave by being covered and come back by landing, so the seam falls on a held frame.
- **Breathe on the seam, briefly.** The rest at the seam is the end hold plus the opening hold: 0.8–1.2 s in all. Longer reads as a stall when the loop repeats.
