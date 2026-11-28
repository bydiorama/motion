# Credits

This library is written from scratch, but some files ship with it that are not
ours, and some of its numbers come from elsewhere. This page names them.

## Bundled material

Each item below keeps its own licence. The licence text travels with the file,
as the licence requires.

- **[DialKit](https://github.com/joshpuckett/dialkit)** — © 2026 Josh Puckett,
  MIT. The studio's parameter panel and timeline dock. The studio imports the
  `dialkit` package (a dev dependency, bundled when the studio is served); the
  showcase ships its stylesheet as `showcase/vendor/dialkit.min.css` and loads
  its script from a CDN at a pinned version. Licence:
  `showcase/vendor/DIALKIT-LICENSE`.
- **[Aspekta](https://github.com/ivodolenc/aspekta)** — © 2025 Ivo Dolenc,
  SIL Open Font License 1.1. The one typeface of the studio, the wizard and
  the bundled stage themes. Redistributed as
  `src/studio/theme/fonts/AspektaVF.woff2` (and embedded from it into the
  stage themes) with the licence text beside it:
  `src/studio/theme/fonts/OFL.txt`. The font stays under the OFL; the MIT
  licence of this repository does not cover it.

## Theme and motion credits

The bundled theme tokens, easing curves, and studio edge fades are © 2026
Diorama and licensed under the MIT licence. The press scale, stagger step,
and hit-area sizes incorporate work © 2026 Jakub Krehel, also licensed
under the MIT licence. See [LICENSE](LICENSE) for the licence terms.

## Tools, not shipped

Dev dependencies in `package.json` and `requirements.txt` (TypeScript,
esbuild, Playwright, yaml, PyYAML) and the ffmpeg the render commands call
are used under their own licences. None of their files are in this
repository.

## References

Library entries describe patterns, not sources (see `docs/MAINTENANCE.md`).
The films and pages that informed them are watched, turned into generic
observations and let go; no footage, frames, artwork or wording from them is
in this repository.

## Trademarks

Every name above is used **nominatively**, to say what this work uses or
draws on. Product and company names are the trademarks of their owners, and a
copyright licence grants no trademark rights: MIT licenses the code, not the
name. Nothing here implies sponsorship, endorsement or affiliation. "Diorama"
and "bydiorama" name the authors of this repository; the MIT licence does not
grant their use as a mark either.
