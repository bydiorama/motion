#!/usr/bin/env python3
"""Build showcase/index.html from showcase/index.src.html.

Inlines the vendored DialKit stylesheet and points the script tag at the pinned CDN build.
Usage: python3 tools/build_showcase.py
"""
from lib import ROOT

DIALKIT_VERSION = "2.1.0"
SHOW = ROOT / "showcase"

def main():
    src = (SHOW / "index.src.html").read_text(encoding="utf-8")
    css = (SHOW / "vendor" / "dialkit.min.css").read_text(encoding="utf-8")
    for marker in ("/*DIALKIT_CSS*/", "<!--DIALKIT_JS-->"):
        if src.count(marker) != 1:
            raise SystemExit(f"index.src.html must contain {marker} exactly once")
    banner = f"/* DialKit {DIALKIT_VERSION} stylesheet, MIT License, github.com/joshpuckett/dialkit */\n"
    script = f'<script src="https://cdn.jsdelivr.net/npm/dialkit@{DIALKIT_VERSION}/dist/vanilla/browser.global.js"></script>'
    out = src.replace("/*DIALKIT_CSS*/", banner + css).replace("<!--DIALKIT_JS-->", script)
    (SHOW / "index.html").write_text(out, encoding="utf-8")
    print(f"showcase/index.html written ({len(out) // 1024} KB)")

if __name__ == "__main__":
    main()
