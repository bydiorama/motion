# Showcase

A short film about the library, built from the library's own entries. It runs as a web page.

- `index.src.html`: the source you edit. The film is one pure `seek(t)` function, like the recipes.
- `index.html`: the built page. Do not edit it; run `python3 tools/build_showcase.py`.
- `vendor/dialkit.min.css`: DialKit 2.1.0 stylesheet (MIT, see `vendor/DIALKIT-LICENSE`).

The page uses [DialKit](https://www.dialkit.dev) for the parameter panel and the timeline dock.
The DialKit script loads from a CDN at a pinned version, so the page needs a network connection.

To view it locally, serve the repository root and open `/showcase/`:

```bash
python3 -m http.server 8000
```
