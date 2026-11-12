# Contributing

Read `docs/DESIGN.md` once, then follow `docs/MAINTENANCE.md` for every change.

Short version:

1. Entries describe patterns, not sources. No links, brand names or "seen in".
2. A new reference usually changes an existing entry (a count, a range). Create a new entry only for new behaviour.
3. Before you commit:

   ```bash
   python3 tools/validate.py && python3 tools/build_index.py
   ```

   If you touched the showcase, also run `python3 tools/build_showcase.py`.
4. Add one line to `CHANGELOG.md`.
5. One topic per pull request. CI runs the same checks.
