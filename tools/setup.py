"""Einrichtung des Soul-Link-Dashboards für eine eigene Gruppe.

Schreibt config.js (Firebase-Werte, Spieleranzahl, Admin-UID, Backup-Adresse) und erzeugt
firestore.rules aus firestore.rules.template. Nur Python 3, keine weiteren Pakete.

    python tools/setup.py                 # Schritt für Schritt fragen (empfohlen beim ersten Mal)
    python tools/setup.py --admin UID     # nur die Admin-UID setzen (config.js und firestore.rules)
    python tools/setup.py --players 4     # nur die Spieleranzahl ändern (2 bis 6)
    python tools/setup.py --rules         # firestore.rules aus Vorlage und config.js neu erzeugen
    python tools/setup.py --private on    # Lesen nur für Freigeschaltete (Backup dann im privaten Repo, docs/INSTALLATION.md)
    python tools/setup.py --reset-data    # alte Backups in backups/ löschen (nach dem Kopieren eines fremden Repos)

Anleitung: docs/INSTALLATION.md
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config.js"
RULES_TEMPLATE = ROOT / "firestore.rules.template"
RULES = ROOT / "firestore.rules"
BACKUPS = ROOT / "backups"
FIREBASE_KEYS = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"]
PLACEHOLDER = "DEIN-PROJEKT"

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def read_config():
    """Vorhandene Werte aus config.js lesen (fehlende Datei = leere Werte)."""
    cfg = {"firebase": {k: "" for k in FIREBASE_KEYS}, "adminUid": "", "autoBackupUrl": "", "playerCount": 3, "privateRead": False}
    if not CONFIG.exists():
        return cfg
    text = CONFIG.read_text(encoding="utf-8")
    for k in FIREBASE_KEYS:
        m = re.search(r'\b%s:\s*"([^"]*)"' % k, text)
        if m:
            cfg["firebase"][k] = m.group(1)
    for k in ("adminUid", "autoBackupUrl"):
        m = re.search(r'\b%s:\s*"([^"]*)"' % k, text)
        if m:
            cfg[k] = m.group(1)
    m = re.search(r'\bplayerCount:\s*(\d+)', text)
    if m:
        cfg["playerCount"] = int(m.group(1))
    cfg["privateRead"] = bool(re.search(r'\bprivateRead:\s*true', text))
    return cfg


def js(v):
    return json.dumps(v, ensure_ascii=False)


def write_config(cfg):
    fb = cfg["firebase"]
    if not fb.get("projectId"):
        fb = {k: (PLACEHOLDER if k == "projectId" else "") for k in FIREBASE_KEYS}
    lines = ",\n".join("    %s: %s" % (k, js(fb.get(k, ""))) for k in FIREBASE_KEYS)
    text = """// Einstellungen dieser Installation. Erzeugt und geändert mit: python tools/setup.py
// Die Firebase-Werte sind nicht geheim: Sie stehen bei jeder Firebase-Web-App im Browser.
// Geschützt wird die Datenbank über firestore.rules (Firebase-Konsole > Firestore > Regeln).
// Steht bei projectId "DEIN-PROJEKT", speichert die Seite nur lokal im Browser.
window.SOULLINK_CONFIG = {
  firebase: {
%s
  },
  // Anzahl der Spieler (2 bis 6). Namen trägt man auf der Seite ein.
  playerCount: %d,
  // Firebase-Kennung (UID) des Admins: darf Backups machen und andere freischalten.
  // Muss mit der UID in firestore.rules übereinstimmen (tools/setup.py hält beide gleich).
  adminUid: %s,
  // Letztes automatisches Backup (GitHub Action, tools/backup.py). Dient nur der Backup-Erinnerung.
  autoBackupUrl: %s,
  // true: Daten lesen nur Admin und Freigeschaltete (firestore.rules), Backup im privaten Repo.
  privateRead: %s
};
""" % (lines, cfg["playerCount"], js(cfg["adminUid"]), js(cfg["autoBackupUrl"]), js(bool(cfg.get("privateRead"))))
    CONFIG.write_text(text, encoding="utf-8", newline="\n")
    print("config.js geschrieben.")


def write_rules(admin_uid, private=False):
    tpl = RULES_TEMPLATE.read_text(encoding="utf-8")
    uid = admin_uid or "NOCH-KEIN-ADMIN"
    if not re.fullmatch(r"[A-Za-z0-9_-]+", uid):
        sys.exit("Die Admin-UID enthält ungültige Zeichen: %r" % uid)
    out = tpl.replace("__ADMIN_UID__", uid).replace("__READ__", "isWriter()" if private else "true")
    out = re.sub(
        r"// VORLAGE:.*?\n// Firestore > Regeln > alles ersetzen > Veröffentlichen\.",
        "// Erzeugt von tools/setup.py aus firestore.rules.template, nicht von Hand ändern.\n"
        "// Einfügen in der Firebase-Konsole: Firestore > Regeln > alles ersetzen > Veröffentlichen.",
        out, count=1, flags=re.S)
    RULES.write_text(out, encoding="utf-8", newline="\n")
    print("firestore.rules erzeugt%s%s." % (", Lesen nur für Freigeschaltete" if private else "", "" if admin_uid else " (noch ohne Admin, erst nach --admin veröffentlichen)"))


def guess_backup_url():
    """Aus dem Git-Remote die Adresse von backups/latest.json ableiten."""
    try:
        url = subprocess.run(["git", "remote", "get-url", "origin"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return ""
    m = re.search(r"github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$", url)
    if not m:
        return ""
    return "https://raw.githubusercontent.com/%s/%s/main/backups/latest.json" % (m.group(1), m.group(2))


def ask(prompt, default=""):
    hint = " [%s]" % default if default else ""
    try:
        val = input("%s%s: " % (prompt, hint)).strip()
    except EOFError:
        val = ""
    return val or default


def paste_firebase():
    print("\nFüge die Firebase-Konfiguration ein (Firebase-Konsole > Projekteinstellungen > Deine Apps > SDK-Konfiguration,")
    print("der Block 'const firebaseConfig = { ... }'). Danach eine leere Zeile. Nur Enter = ohne Firebase (nur lokal).")
    lines = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if not line.strip():
            if lines:
                break
            return None
        lines.append(line)
        if "}" in line:
            break
    text = "\n".join(lines)
    fb = {}
    for k in FIREBASE_KEYS:
        m = re.search(r'\b%s\s*:\s*["\']([^"\']*)["\']' % k, text)
        if m:
            fb[k] = m.group(1)
    if not fb.get("projectId") or not fb.get("apiKey"):
        sys.exit("projectId oder apiKey nicht gefunden. Bitte den ganzen Block einfügen.")
    return fb


def player_count(v):
    try:
        n = int(v)
    except (TypeError, ValueError):
        sys.exit("Spieleranzahl muss eine Zahl sein.")
    if not 2 <= n <= 6:
        sys.exit("Spieleranzahl muss zwischen 2 und 6 liegen.")
    return n


def reset_data(force):
    files = sorted(BACKUPS.glob("*.json")) if BACKUPS.exists() else []
    if not files:
        print("backups/ ist schon leer.")
        return
    if not force and ask("%d Backup-Dateien in backups/ löschen? (ja/nein)" % len(files), "nein").lower() not in ("ja", "j", "yes", "y"):
        print("Nichts gelöscht.")
        return
    for f in files:
        f.unlink()
    print("%d Backup-Dateien gelöscht." % len(files))


def interactive(cfg):
    print("Soul-Link-Dashboard einrichten. Enter übernimmt den Wert in [Klammern].")
    fb = paste_firebase()
    if fb is not None:
        cfg["firebase"] = {k: fb.get(k, "") for k in FIREBASE_KEYS}
    elif cfg["firebase"].get("projectId") in ("", PLACEHOLDER):
        cfg["firebase"] = {}
        print("Ohne Firebase: Die Seite speichert nur im Browser.")
    cfg["playerCount"] = player_count(ask("\nWie viele Spieler (2 bis 6)?", str(cfg["playerCount"])))
    cfg["adminUid"] = ask("\nAdmin-UID (leer lassen, wenn noch unbekannt: die Seite zeigt sie nach der ersten Anmeldung an)", cfg["adminUid"])
    cfg["autoBackupUrl"] = ask("\nAdresse von backups/latest.json für die Backup-Erinnerung", cfg["autoBackupUrl"] or guess_backup_url())
    if BACKUPS.exists() and any(BACKUPS.glob("*.json")):
        reset_data(False)
    return cfg


def main():
    ap = argparse.ArgumentParser(description="Soul-Link-Dashboard einrichten (config.js und firestore.rules).")
    ap.add_argument("--admin", metavar="UID", help="Admin-UID setzen")
    ap.add_argument("--players", metavar="N", help="Spieleranzahl setzen (2 bis 6)")
    ap.add_argument("--rules", action="store_true", help="nur firestore.rules neu erzeugen")
    ap.add_argument("--private", choices=["on", "off"], help="Lesen nur für Freigeschaltete ein- oder ausschalten")
    ap.add_argument("--reset-data", action="store_true", help="Backups in backups/ löschen")
    ap.add_argument("--yes", action="store_true", help="bei --reset-data nicht nachfragen")
    a = ap.parse_args()
    cfg = read_config()

    if a.reset_data:
        reset_data(a.yes)
    if a.admin is not None or a.players is not None or a.private is not None:
        if a.admin is not None:
            cfg["adminUid"] = a.admin.strip()
        if a.players is not None:
            cfg["playerCount"] = player_count(a.players)
        if a.private is not None:
            cfg["privateRead"] = a.private == "on"
            if cfg["privateRead"]:
                cfg["autoBackupUrl"] = ""   # backups/ liegt dann im privaten Repo, die Seite liest meta.autoBackupAt
        write_config(cfg)
        write_rules(cfg["adminUid"], cfg["privateRead"])
    elif a.rules:
        write_rules(cfg["adminUid"], cfg["privateRead"])
    elif not a.reset_data:
        cfg = interactive(cfg)
        write_config(cfg)
        write_rules(cfg["adminUid"], cfg["privateRead"])
        print("\nFertig. Nächste Schritte: docs/INSTALLATION.md (committen, pushen, Regeln in Firebase einfügen).")


if __name__ == "__main__":
    main()
