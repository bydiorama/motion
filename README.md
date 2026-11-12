# Motion Library

Our own vocabulary for making motion videos with code. It is the reference that the motion skills read.

A video = **one narrative + one style + brand input**.

| Layer | What it is | Folder |
|---|---|---|
| Primitive | One move: an effect, a transition, a text animation, a 3D rig, a scene type | `library/primitives/<group>/` |
| Style | Our named look: a set of preferred primitives, timing and surface | `library/styles/` |
| Narrative | A story structure: beats in order, with a share of time each | `library/narratives/` |

Other parts:

- `INDEX.md`: one line per entry. Generated. Start here.
- `tokens.yaml`: global timing and easing defaults. Styles override them.
- `recipes/`: code for primitives, one file per slug, all with the same interface.
- `examples/`: example storyboards (what a director skill outputs).
- `templates/`: starting files for new entries.
- `showcase/`: a short film about the library, built from its own entries.
- `tools/`: validation, index building, recipe checking, showcase build.
- `.github/workflows/validate.yml`: runs the checks on every pull request.
- `docs/DESIGN.md`: why the library is built this way.
- `docs/MAINTENANCE.md`: how to add references, change entries and release versions.

## Daily commands

```bash
python3 tools/new_entry.py primitive fx/my-effect   # start a new entry
python3 tools/validate.py                           # check everything
python3 tools/build_index.py                        # refresh INDEX.md
python3 tools/check_recipe.py type/word-build       # test one recipe in Chrome
python3 tools/build_showcase.py                     # rebuild showcase/index.html
```

Setup: `pip install -r requirements.txt` (Python 3.10+). Recipe checks also need Chrome.

## The one rule

Entries describe **patterns, not sources**. No links, no brand names, no "seen in". References are inspiration: they are watched, broken into generic observations, and then thrown away. See `docs/MAINTENANCE.md`.

## Licence

No licence file is included yet, so the content is not licensed for reuse by others. Add one before making the repository public. The showcase bundles the DialKit stylesheet under its MIT licence (`showcase/vendor/DIALKIT-LICENSE`).
