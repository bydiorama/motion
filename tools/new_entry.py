#!/usr/bin/env python3
"""Create a new draft entry from a template.

Usage: python3 tools/new_entry.py primitive fx/my-effect
       python3 tools/new_entry.py style my-style
       python3 tools/new_entry.py narrative my-story
"""
import sys
from lib import ROOT, LIB

def main():
    kind, name = sys.argv[1], sys.argv[2]
    folder = {"primitive": "primitives", "style": "styles", "narrative": "narratives"}[kind]
    dest = LIB / folder / f"{name}.md"
    if dest.exists(): sys.exit(f"{dest} already exists")
    slug = name if kind == "primitive" else f"{kind}/{name}"
    text = (ROOT / "templates" / f"{kind}.md").read_text()
    text = text.replace("SLUG", slug).replace("GROUP", name.split("/")[0])
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text)
    print(f"created {dest.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
