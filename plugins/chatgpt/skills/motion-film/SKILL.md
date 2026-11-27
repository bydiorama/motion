---
name: motion-film
description: Create and revise Diorama motion films from a video idea, a Motion brief, an existing .film.json, or studio notes in a .tune.json. Use for animated announcements, product films, title sequences and social loops.
---

# Motion film

Deliver an editable film that the Diorama Motion studio can open. Paths below are relative to this skill.

1. Read the brief or attached film. Establish the message, audience, duration and frame size. Use the supplied brand assets and copy. For stand-in content, set `theme.ui` to `zero` and use the theme's font and colour roles.
2. Read `references/library.json` to choose a narrative and style. Give each beat one scene, an intent and enough time to read its main line. Use `references/CRAFT.md` for rhythm, composition and transitions.
3. Consult `references/film.md` for the film shape and `references/catalog.json` for drawable slugs, props, parameter ranges and eases. The library also describes moves awaiting implementation. Use catalogued primitives to draw each beat. Start from `references/example.film.json` if helpful. The full schema is in `references/film.schema.json`.
4. Set the tempo and use beat-relative timings. Keep asset paths relative to the film and identify any files the person still needs to supply. For revisions, read the person's tune and pinned notes, keep existing scene and layer IDs, and make the edits in the film. Return a short response to each note.
5. When a shell and Node are available, run `node "<skill directory>/scripts/check-film.mjs" "<film path>"`. This checks the film JSON with the library resolver and reports pacing. Fix errors and review warnings. The check reads only the film JSON. The local studio applies tune overrides and loads media.
6. Return the complete film as a downloadable `.film.json` or a single JSON block. Say which checks ran. With access to the Motion CLI, run `motion stills` and `motion check` on the film and inspect the contact sheet. Otherwise give the local preview command, e.g. `motion preview films/announcement.film.json`. For MP4 delivery use `motion render` followed by `motion review` when the renderer and assets are available.
