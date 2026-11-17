#!/usr/bin/env python3
"""Automatisches Backup des Soul-Link-Dashboards.

Liest meta, routes und history aus Firestore (Lesen ist ohne Anmeldung erlaubt) und schreibt
sie im selben Format wie der Knopf "Als Datei speichern". So eine Datei lässt sich auf der
Seite unter "Backup einspielen" wieder einspielen.

- backups/latest.json      immer der neueste Stand
- backups/JJJJ-MM-TT.json  ein Stand pro Tag, an dem sich etwas geändert hat

Geschrieben wird nur, wenn sich die Daten seit latest.json geändert haben.
Die Freischaltliste (access/main) ist nicht öffentlich lesbar und kommt nicht ins Backup.

Aufruf: python3 tools/backup.py   (läuft täglich per GitHub Action, siehe .github/workflows/backup.yml)
Nur Standardbibliothek, keine Pakete nötig.
"""
import datetime
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "backups"
COLLECTIONS = ("meta", "routes", "history")


def read_config():
    """Projekt-ID und API-Key aus config.js lesen, damit sie nur an einer Stelle stehen."""
    text = (ROOT / "config.js").read_text(encoding="utf-8")
    project = re.search(r'projectId:\s*"([^"]+)"', text)
    key = re.search(r'apiKey:\s*"([^"]+)"', text)
    if project and project.group(1).startswith("DEIN"):
        print("config.js ohne Firebase (lokaler Modus), nichts zu sichern.")
        sys.exit(0)
    if not project or not key:
        sys.exit("config.js enthält keine Firebase-Werte, nichts zu sichern.")
    return project.group(1), key.group(1)


def decode(value):
    """Firestore-REST-Wert in normales JSON umwandeln."""
    kind, v = next(iter(value.items()))
    if kind == "mapValue":
        return {k: decode(x) for k, x in v.get("fields", {}).items()}
    if kind == "arrayValue":
        return [decode(x) for x in v.get("values", [])]
    if kind == "integerValue":
        return int(v)
    if kind == "nullValue":
        return None
    return v  # stringValue, booleanValue, doubleValue, timestampValue


def fetch_collection(project, key, name):
    base = f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/{name}"
    docs, token = {}, None
    while True:
        params = {"key": key, "pageSize": 300}
        if token:
            params["pageToken"] = token
        with urllib.request.urlopen(base + "?" + urllib.parse.urlencode(params), timeout=30) as resp:
            data = json.load(resp)
        for doc in data.get("documents", []):
            docs[doc["name"].rsplit("/", 1)[1]] = decode({"mapValue": {"fields": doc.get("fields", {})}})
        token = data.get("nextPageToken")
        if not token:
            return docs


def content(backup):
    """Vergleichbarer Inhalt ohne Zeitstempel des Exports."""
    return json.dumps({k: backup[k] for k in COLLECTIONS}, sort_keys=True, ensure_ascii=False)


def main():
    project, key = read_config()
    data = {name: fetch_collection(project, key, name) for name in COLLECTIONS}
    if "main" not in data["meta"]:
        sys.exit("meta/main fehlt in Firestore, Backup abgebrochen.")
    if not data["routes"]:
        sys.exit("Keine Routen in Firestore, Backup abgebrochen (schützt das letzte gute Backup).")

    now = datetime.datetime.now(datetime.timezone.utc)
    backup = {
        "app": "soullink-bw",
        "version": 2,
        "exportedAt": now.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "source": "auto",
        "meta": data["meta"]["main"],
        "routes": data["routes"],
        "history": data["history"],
    }

    latest = OUT / "latest.json"
    if latest.exists():
        try:
            if content(json.loads(latest.read_text(encoding="utf-8"))) == content(backup):
                print("Keine Änderung seit dem letzten Backup.")
                return
        except (ValueError, KeyError):
            pass  # kaputte oder alte Datei: neu schreiben

    OUT.mkdir(exist_ok=True)
    text = json.dumps(backup, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    day = OUT / (now.strftime("%Y-%m-%d") + ".json")
    day.write_text(text, encoding="utf-8")
    latest.write_text(text, encoding="utf-8")
    print(f"Backup geschrieben: {day.name} ({len(backup['routes'])} Routen, {len(backup['history'])} Runs im Verlauf)")


if __name__ == "__main__":
    main()
