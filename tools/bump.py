"""Setzt eine neue Versionsnummer, damit Browser nach einem Deploy keine alten Dateien mischen.

GitHub Pages lässt Browser Dateien 10 Minuten zwischenspeichern. Ohne neue Version kann ein Browser
eine neue index.html mit einer alten js/app.js kombinieren, dann bricht die Seite ab.

Aufruf vor jedem Commit, der index.html, css/ oder js/ ändert:
    python tools/bump.py
Ändert index.html (data-v und ?v= an CSS und Skripten) und APP_V in js/app.js.
"""
import datetime
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rewrite(rel, pattern, repl, expected):
    path = os.path.join(ROOT, rel)
    text = io.open(path, encoding="utf-8").read()
    new, n = re.subn(pattern, repl, text)
    if n != expected:
        sys.exit(f"{rel}: {n} Treffer fuer {pattern!r}, erwartet {expected}")
    io.open(path, "w", encoding="utf-8", newline="\n").write(new)


def main():
    v = datetime.datetime.now().strftime("%Y%m%d%H%M")
    rewrite("index.html", r'(<html [^>]*data-v=")[^"]*"', rf'\g<1>{v}"', 1)
    rewrite("index.html", r'((?:css/style\.css|config\.js|js/games\.js|js/pokemon\.js|js/evo\.js|js/types\.js|js/app\.js)\?v=)[^"]*"', rf'\g<1>{v}"', 7)
    rewrite("js/app.js", r'var APP_V="[^"]*";', f'var APP_V="{v}";', 1)
    print("Version", v)


if __name__ == "__main__":
    main()
