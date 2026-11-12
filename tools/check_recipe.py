#!/usr/bin/env python3
"""Check one recipe: it loads, seeking is repeatable, and frames are saved to look at.

Usage: python3 tools/check_recipe.py type/word-build
Needs: pip install playwright, and Chrome installed.
"""
import functools, hashlib, http.server, sys, threading
from playwright.sync_api import sync_playwright
from lib import ROOT

def main():
    slug = sys.argv[1]
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=str(ROOT / "recipes"))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    out = ROOT / "out" / slug.replace("/", "_"); out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="chrome")
        page = b.new_page(viewport={"width": 1920, "height": 1080})
        page.goto(f"http://127.0.0.1:{srv.server_port}/_harness.html?recipe={slug}")
        page.wait_for_function("window.ready === true")
        dur = page.evaluate("recipe.duration")
        times = [round(dur * k / 4, 3) for k in range(5)]
        def shot(t):
            page.evaluate("t => recipe.seek(t)", t)
            return page.screenshot(type="jpeg", quality=92)
        first = {t: shot(t) for t in times}
        again = {t: shot(t) for t in reversed(times)}  # other order: must not depend on history
        ok = all(hashlib.sha1(first[t]).digest() == hashlib.sha1(again[t]).digest() for t in times)
        for t in times: (out / f"t{t:.2f}.jpg").write_bytes(first[t])
        b.close()
    print(f"{slug}: duration {dur:.2f}s, repeatable seek: {'yes' if ok else 'NO'}, frames in {out.relative_to(ROOT)}/")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
