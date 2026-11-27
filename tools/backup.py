#!/usr/bin/env python3
"""Automatisches Backup des Soul-Link-Dashboards.

Liest meta, routes und history aus Firestore und schreibt sie im selben Format wie der Knopf
"Als Datei speichern". So eine Datei lässt sich auf der
Seite unter "Backup einspielen" wieder einspielen.

- backups/latest.json      immer der neueste Stand
- backups/JJJJ-MM-TT.json  ein Stand pro Tag, an dem sich etwas geändert hat

Geschrieben wird nur, wenn sich die Daten seit latest.json geändert haben.
Die Freischaltliste (access/main) ist nicht öffentlich lesbar und kommt nicht ins Backup.

Lesen:
- ohne Anmeldung (Firestore-Regeln erlauben Lesen für alle, privateRead: false), oder
- mit Dienstkonto: Umgebungsvariable FIREBASE_SERVICE_ACCOUNT = Inhalt der JSON-Schlüsseldatei
  (Firebase-Konsole > Projekteinstellungen > Dienstkonten). Nötig bei privateRead: true. Dann trägt das
  Skript nach jedem Lauf meta.autoBackupAt ein, damit die Seite weiß, dass das Backup aktuell ist.

Zielordner: backups/ in diesem Repo oder BACKUP_DIR (privates Backup-Repo, siehe tools/private-backup.yml).

Aufruf: python3 tools/backup.py   (läuft täglich per GitHub Action, siehe .github/workflows/backup.yml)
Nur Standardbibliothek; mit Dienstkonto zusätzlich das Programm openssl (auf GitHub-Runnern vorhanden).
"""
import base64
import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(os.environ["BACKUP_DIR"]) if os.environ.get("BACKUP_DIR") else ROOT / "backups"
SCOPE = "https://www.googleapis.com/auth/datastore"
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


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def access_token():
    """OAuth-Token des Dienstkontos (JWT, mit openssl signiert) oder None ohne FIREBASE_SERVICE_ACCOUNT."""
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if not raw:
        return None
    sa = json.loads(raw)
    now = int(time.time())
    head = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64(json.dumps({"iss": sa["client_email"], "scope": SCOPE, "aud": sa["token_uri"],
                             "iat": now, "exp": now + 3600}).encode())
    fd, keyfile = tempfile.mkstemp(suffix=".pem")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(sa["private_key"])
        sig = subprocess.run(["openssl", "dgst", "-sha256", "-sign", keyfile],
                             input=(head + "." + claims).encode(), capture_output=True, check=True).stdout
    finally:
        os.remove(keyfile)
    body = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                   "assertion": head + "." + claims + "." + b64(sig)}).encode()
    with urllib.request.urlopen(urllib.request.Request(sa["token_uri"], data=body), timeout=30) as resp:
        return json.load(resp)["access_token"]


def request(url, token, data=None, method=None):
    req = urllib.request.Request(url, data=data, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        if e.code == 403 and not token:
            sys.exit("Firestore verweigert das Lesen. Bei privateRead: true braucht das Backup das Secret "
                     "FIREBASE_SERVICE_ACCOUNT (docs/INSTALLATION.md, Daten nicht öffentlich).")
        raise


def fetch_collection(project, key, name, token):
    base = f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/{name}"
    docs, page = {}, None
    while True:
        params = {"pageSize": 300}
        if not token:
            params["key"] = key
        if page:
            params["pageToken"] = page
        data = request(base + "?" + urllib.parse.urlencode(params), token)
        for doc in data.get("documents", []):
            docs[doc["name"].rsplit("/", 1)[1]] = decode({"mapValue": {"fields": doc.get("fields", {})}})
        page = data.get("nextPageToken")
        if not page:
            return docs


def mark_checked(project, token, stamp):
    """meta.autoBackupAt setzen (nur mit Dienstkonto; die Firestore-Regeln gelten dafür nicht)."""
    url = (f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/meta/main"
           "?updateMask.fieldPaths=autoBackupAt&currentDocument.exists=true")
    body = json.dumps({"fields": {"autoBackupAt": {"stringValue": stamp}}}).encode()
    request(url, token, body, "PATCH")


def content(backup):
    """Vergleichbarer Inhalt ohne Zeitstempel des Exports und ohne meta.autoBackupAt."""
    c = {k: backup[k] for k in COLLECTIONS}
    c["meta"] = {k: v for k, v in c["meta"].items() if k != "autoBackupAt"}
    return json.dumps(c, sort_keys=True, ensure_ascii=False)


def main():
    project, key = read_config()
    private = re.search(r"\bprivateRead:\s*true", (ROOT / "config.js").read_text(encoding="utf-8"))
    if private and not os.environ.get("FIREBASE_SERVICE_ACCOUNT"):
        print("privateRead: true, das Backup läuft im privaten Backup-Repo (tools/private-backup.yml).")
        return
    token = access_token()
    data = {name: fetch_collection(project, key, name, token) for name in COLLECTIONS}
    if "main" not in data["meta"]:
        sys.exit("meta/main fehlt in Firestore, Backup abgebrochen.")
    if not data["routes"]:
        sys.exit("Keine Routen in Firestore, Backup abgebrochen (schützt das letzte gute Backup).")

    now = datetime.datetime.now(datetime.timezone.utc)
    stamp = now.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    backup = {
        "app": "soullink-bw",
        "version": 2,
        "exportedAt": stamp,
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
                if token:
                    mark_checked(project, token, stamp)
                return
        except (ValueError, KeyError):
            pass  # kaputte oder alte Datei: neu schreiben

    OUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(backup, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    day = OUT / (now.strftime("%Y-%m-%d") + ".json")
    day.write_text(text, encoding="utf-8")
    latest.write_text(text, encoding="utf-8")
    print(f"Backup geschrieben: {day.name} ({len(backup['routes'])} Routen, {len(backup['history'])} Runs im Verlauf)")
    if token:
        mark_checked(project, token, stamp)


if __name__ == "__main__":
    main()
