"""Klicktest: startet einen lokalen Server und lässt tests/smoke.html in einem Browser ohne Fenster laufen.

Die Seite läuft dabei im Testmodus (index.html?test=1): nur lokaler Speicher, nie Firebase.
Die Testseite schickt ihr Ergebnis per POST an diesen Server, danach wird der Browser beendet.
Braucht Chrome, Chromium, Edge oder Brave (Pfad notfalls in der Umgebungsvariable CHROME).

Aufruf vor jedem Commit mit Änderungen an index.html, css/ oder js/:
    python tools/test.py
Ohne Browser-Automatik: python3 -m http.server 8000 und http://localhost:8000/tests/smoke.html öffnen.
"""
import functools
import http.server
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TIMEOUT = 120

CANDIDATES = [
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome", "msedge",
    "brave-browser", "brave",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
]


def from_registry():
    """Windows: Pfad aus App Paths (Chrome, Edge, Brave), egal wo installiert."""
    try:
        import winreg
    except ImportError:
        return None
    for exe in ("chrome.exe", "msedge.exe", "brave.exe"):
        for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
            try:
                with winreg.OpenKey(hive, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths" + "\\" + exe) as k:
                    p = winreg.QueryValue(k, None)
                    if p and os.path.isfile(p):
                        return p
            except OSError:
                pass
    return None


def find_browser():
    env = os.environ.get("CHROME")
    if env:
        return env
    reg = from_registry()
    if reg:
        return reg
    for c in CANDIDATES:
        p = shutil.which(c) or (c if os.path.isfile(c) else None)
        if p:
            return p
    sys.exit("Kein Chrome, Chromium, Edge oder Brave gefunden. Pfad in der Umgebungsvariable CHROME angeben.")


class Handler(http.server.SimpleHTTPRequestHandler):
    result = None
    done = threading.Event()

    def log_message(self, *args):
        pass

    def do_POST(self):
        if self.path != "/__result":
            self.send_error(404)
            return
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        Handler.result = json.loads(body.decode("utf-8"))
        self.send_response(204)
        self.end_headers()
        Handler.done.set()


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    browser = find_browser()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=ROOT))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d/tests/smoke.html?report=1" % server.server_address[1]
    profile = tempfile.mkdtemp(prefix="soullink-test-")
    cmd = [browser, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
           "--user-data-dir=" + profile, url]
    if sys.platform.startswith("linux"):
        cmd.insert(1, "--no-sandbox")
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        finished = Handler.done.wait(TIMEOUT)
    finally:
        proc.kill()
        proc.wait()
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)
    if not finished:
        sys.exit("Kein Ergebnis nach %d s (Browser: %s)." % (TIMEOUT, browser))
    res = Handler.result or {}
    print((res.get("log") or "").rstrip())
    if res.get("status") != "pass":
        sys.exit("Klicktest nicht bestanden.")
    print("Klicktest bestanden.")


if __name__ == "__main__":
    main()
