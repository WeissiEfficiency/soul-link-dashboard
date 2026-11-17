# Changelog

## 2026-11-16

### Hinzugefügt
- Spieleranzahl 2 bis 6 (`playerCount` in `config.js`): Routenzellen, Spielerkarten, Zähler, Tabellen, Run-Ender, Farben und Firestore-Regeln passen sich an.
- Einrichtung für andere Gruppen: `tools/setup.py` (schreibt `config.js`, erzeugt `firestore.rules` aus `firestore.rules.template`, setzt Admin-UID und Spieleranzahl, leert alte Backups) und Anleitung `docs/INSTALLATION.md`. Ohne eingetragenen Admin zeigt die Willkommensseite die eigene UID samt Befehl.
- Anonymisiert: keine Spielernamen, UIDs oder Projektdaten mehr in Code und Doku (nur noch in `config.js` und den Backups dieser Installation). Ohne Namen zeigt die Seite „Spieler 1“ usw.
- Sieges-Feuerwerk zeigt die überlebenden Pokémon als Pixel-Explosion (Schwarz/Weiß-Sprites, je Spieler bis zu zwei), Pikachu nur noch als Ersatz.
- Willkommensseite: Im Firebase-Modus sehen nur der Admin und die unter „Schreibrechte“ eingetragenen Google-Konten das Dashboard, alle anderen eine Willkommensseite mit Anmeldeknopf. Daten werden erst nach der Freigabe geladen.
- Sieges-Feuerwerk länger und größer, mit einem Pokéball und einem Pikachu als Pixel-Explosion.
- Run-Status ohne Umschalter: Knopf „Run verloren“ (mit „Doch nicht verloren“), „Gewonnen“ automatisch, sobald jede Route gespielt ist, oder per Knopf „Run gewonnen“ (nur Admin), mit kleinem Feuerwerk. „Neuer Run starten“ erscheint erst, wenn der Run verloren oder gewonnen ist.
- Nicht gefangen (∅) zählt wie ein Tod: Die verbundenen Pokémon sterben mit, der Link steht im Friedhof, und jeder, der nicht gefangen hat, bekommt einen Encounter.
- Routen erscheinen nacheinander: Sichtbar sind die bisher bearbeiteten Routen und die nächste offene. Sobald dort ein Spitzname, ein Pokémon oder ein Zustand eingetragen ist, kommt die nächste dazu. „Alle Routen zeigen“ und „Route hinzufügen“ stehen jetzt unter der Liste; Filter und Suche zeigen weiter alle passenden Routen.
- Designs: Pokédex (Rot/Weiß, Pixelschrift, Textboxen, KP-Balken) ist Standard für alle. Der Admin kann oben rechts zusätzlich Pastell (bisheriges Design) oder Lovecraft (Tiefsee-Nacht, Pergament, alte Druckschrift, blinzelndes Auge) wählen; die Wahl merkt sich sein Gerät.

### Behoben
- Seite lud nach einem Deploy manchmal nicht richtig, weil der Browser neue und alte Dateien mischte (GitHub Pages speichert 10 Minuten zwischen). CSS und Skripte haben jetzt eine Versionsnummer, und passt sie nicht zur Seite, lädt die Seite einmal neu (`tools/bump.py`).
- Pokédex-Design: Schrift Tiny5 statt Pixelify Sans, die 5 und das kleine e waren kaum lesbar (ohne künstliches Fett, damit die Pixel scharf bleiben).
- Handy: Der Run-Kasten war rechts abgeschnitten („Neuer Run starten“, „Gewonnen“).
- Automatisches Backup: GitHub Action sichert täglich mit `tools/backup.py` nach `backups/` (nur bei Änderungen). Die Backup-Erinnerung berücksichtigt das automatische Backup.
- Google-Anmeldung: Schreiben nur noch für den Admin und freigeschaltete Google-E-Mails, ohne Anmeldung nur lesen. Backup und neuer Bereich „Schreibrechte“ nur für den Admin.
- Backup-Erinnerung: Hinweis oben auf der Seite, wenn die letzte Sicherung fehlt oder älter als 7 Tage ist; Datum der letzten Sicherung im Backup-Bereich (neues Feld `meta.backupAt`).
- Strengere Firestore-Regeln: nur bekannte Felder und begrenzte Textlängen, Run-Daten und Run-Verlauf nicht löschbar.
- Repo angelegt, Seite aufgeteilt in `index.html`, `css/style.css`, `js/app.js`, `js/pokemon.js`.
- Speicherung in Firebase Firestore für GitHub Pages (ohne Account für Mitspieler), lokaler Modus als Rückfall.
- Pokémon-Suche über alle 649 deutschen Namen, tippfehlertolerant und per Dex-Nummer.
- Level-Caps aller Arenaleiter, Top Vier, N und G-Cis mit änderbaren Werten; aktueller Cap im Run-Bereich.
- Auswertung: Gesamtstand pro Spieler, Run-Verlauf, häufigste Run-Enden, gefährlichste Routen.
- Backup kopieren, als Datei speichern und einspielen.
- GitHub Pages aktiviert (Branch `main`, Ordner `/`).
- Firebase-Projekt angelegt (Firestore in Frankfurt, Regeln gesetzt), Werte in `config.js` eingetragen.

### Geändert
- Ein Spitzname pro Route statt pro Spieler; Pokémon pro Spieler ist optional. Alte Einträge werden übernommen.

## Vor dem Repo (claude.ai-Artifact)

- Dashboard mit Routen, Fängen, Toden, Friedhof, Gesamtliste, Run-Zähler (Run, Death, Encounter) und Pastell-Design.
