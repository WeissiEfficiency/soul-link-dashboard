# CLAUDE.md

Soul-Link-Dashboard für alle Pokémon-Hauptspiele (Gen 1 bis 9, deutsch, Standard Schwarz/Weiß, der Admin wählt das Spiel) mit 2 bis 6 Spielern (`playerCount` in `config.js`). Statische Seite ohne Build-Schritt, läuft auf GitHub Pages, speichert live in Firebase Firestore. Andere Gruppen richten eigene Kopien mit `tools/setup.py` ein (Anleitung `docs/INSTALLATION.md`), deshalb keine Namen, UIDs oder Projektdaten in Code und Doku, nur in `config.js` und `backups/`.

**Einstieg in jede Session:** `docs/BACKLOG.md`, Abschnitt „Aktueller Stand“.

## Befehle

- Lokal starten: `python3 -m http.server 8000`, dann http://localhost:8000
- Syntax prüfen: `node --check js/app.js && node --check js/games.js && node --check js/pokemon.js && node --check js/types.js && node --check js/evo.js`
- Version setzen (vor jedem Commit mit Änderungen an `index.html`, `css/` oder `js/`): `python tools/bump.py`
- Deploy: Push auf `main`, GitHub Pages veröffentlicht automatisch.

## Dateien

- `index.html`: Markup aller Bereiche
- `css/style.css`: Design (Tokens in `:root`, Themes Pokédex (Standard), Pastell, Lovecraft als `:root[data-theme=…]` am Dateiende; Umschalter nur für den Admin)
- `js/app.js`: gesamte Logik (Speicher-Adapter, Rendering, Zähler, Suche)
- `js/games.js`: Spiele für den Spiele-Schalter (Region, Generation, Dex-Bereich, Standard-Routen, Level-Caps)
- `js/pokemon.js`: 1025 deutsche Pokémon-Namen (Gen 1 bis 9), Index + 1 = Dex-Nummer
- `js/types.js`: Typen aller Pokémon und Regionalformen für die Schwächen-Karte, die Team-Leiste und die Routen (aus PokeAPI erzeugt)
- `js/evo.js`: Entwicklungsreihe jedes Pokémon (`POKE_CHAIN`) für den Dupe-Hinweis (aus PokeAPI erzeugt)
- `config.js`: Einstellungen dieser Installation (Firebase-Werte, `playerCount`, `adminUid`, `autoBackupUrl`), erzeugt von `tools/setup.py`; Platzhalter `DEIN-PROJEKT` = lokaler Modus
- `firestore.rules.template`: Quelle der Firestore-Regeln mit Platzhalter `__ADMIN_UID__`. Hier ändern, dann `python tools/setup.py --rules`
- `firestore.rules`: daraus erzeugt, wird in der Firebase-Konsole eingefügt (nicht automatisch)
- `tools/setup.py`: Einrichtung für eine Gruppe (config.js, firestore.rules, Admin-UID, Spieleranzahl, Backups leeren)
- `tools/bump.py`: neue Versionsnummer in `index.html` (`data-v`, `?v=`) und `js/app.js` (`APP_V`), gegen gemischte Browser-Caches
- `tools/backup.py` + `.github/workflows/backup.yml`: tägliches Auto-Backup nach `backups/` (nicht von Hand bearbeiten)

## Konventionen

- Kein Framework, kein Build, keine npm-Abhängigkeiten. Firebase compat SDK wird nur geladen, wenn `config.js` ausgefüllt ist.
- UI-Texte und Doku auf Deutsch, Spielbegriffe mit deutschen Namen (Orte, Pokémon, Trainer). Code-Bezeichner englisch.
- Spieler nie fest auf drei: Schleifen über `NP` bzw. `IDX`, Schlüssel aus `P`, Standardwerte über `perPlayer()`. Farben `--p0` … `--p5` in jedem Theme.
- Datenmodell siehe `docs/ARCHITEKTUR.md`. Neue Felder immer mit Standardwert in `defMeta()` bzw. beim Anlegen von Routen ergänzen, alte Daten müssen weiter laden (z. B. `nickOf()` liest Spitznamen aus Altdaten). Neue Felder außerdem in `firestore.rules.template` erlauben, `python tools/setup.py --rules` ausführen und die Regeln in der Firebase-Konsole neu veröffentlichen, sonst lehnt Firestore jedes Speichern des Dokuments ab.
- Schreibzugriffe nur über `patchRoute()` / `patchMeta()` (gebündelt, 450 ms Verzögerung), nie direkt aus Render-Funktionen.
- Schreibrechte im Firebase-Modus: Google-Anmeldung, Admin-UID in `config.js` und `firestore.rules` (beide über `tools/setup.py --admin`), Freigaben in `access/main` (siehe `docs/ARCHITEKTUR.md`). Admin-only-Bereiche über `applyRole()` steuern.
- Farben nur über CSS-Variablen, nie fest in Bausteinen, sonst bricht ein Theme. Sprüche je Theme in `THEME_TXT` (`js/app.js`).
- Die gleiche Seite läuft auch als claude.ai-Artifact (Speicher-Adapter `makeArtifactStore`). Nichts einbauen, das nur mit Firebase funktioniert, ohne den Artifact- und Lokal-Modus zu bedenken.

## Nach Änderungen

Backlog und CHANGELOG aktualisieren; Architektur nur bei Struktur- oder Datenmodelländerungen.
