# Soul Link Dashboard – Pokémon

Dashboard für eine Pokémon-Soul-Link-Challenge in den **Pokémon-Hauptspielen von Rot/Blau bis Karmesin/Purpur (deutsche Version)** mit **2 bis 6 Spielern**. Es zeigt Routen und Fänge, wer welchen Encounter getötet hat, Tode, Run-Zähler, Level-Caps und eine Auswertung über alle Runs. Alle Spieler sehen live denselben Stand.

**Eigene Installation:** Vorlage [soul-link-dashboard](https://github.com/WeissiEfficiency/soul-link-dashboard) mit **Use this template** kopieren und [docs/INSTALLATION.md](docs/INSTALLATION.md) folgen. Ein Skript (`python tools/setup.py`) erledigt die Einstellungen, der Rest sind ein paar Klicks bei GitHub und Firebase. Kostenlos.

## Funktionen

- Spiel wählbar (nur Admin, gilt ab dem nächsten Run): Rot/Blau, Gelb, Gold/Silber/Kristall, Rubin/Saphir, Smaragd, Feuerrot/Blattgrün, Diamant/Perl, Platin, HeartGold/SoulSilver, Schwarz/Weiß (Standard), Schwarz 2/Weiß 2, X/Y, Omega Rubin/Alpha Saphir, Sonne/Mond, Ultrasonne/Ultramond, Let's Go, Schwert/Schild, Strahlender Diamant/Leuchtende Perle, Karmesin/Purpur
- Standard-Routen des Spiels, eigene Routen ergänzbar, Fossil als Extra-Encounter; die Routen erscheinen nacheinander, sobald die vorige eingetragen ist („Alle Routen zeigen“ blendet den Rest ein)
- Ein Spitzname pro Route (gilt für alle Pokémon des Links), Pokémon pro Spieler optional mit Suche über die deutschen Namen des Spiels (bis zu 1025) (tippfehlertolerant, auch per Dex-Nummer)
- Zustand pro Spieler: lebt, tot, nicht gefangen; stirbt einer oder fängt einer nicht, sterben die verbundenen mit
- Run verloren per Knopf, gewonnen automatisch, sobald jede Route gespielt ist, oder per Admin-Knopf; Feuerwerk mit den Figuren der überlebenden Pokémon
- Beim toten Link: wer den Encounter getötet hat, bei wem das Pokémon im Kampf gefallen ist (Death), Ursache
- Run-Nummer und Gesamtstand Run, Death, Encounter pro Spieler (zählt automatisch, von Hand änderbar)
- Level-Caps aller Arenaleiter (bzw. Inselkönige), Top Vier und Champ zum Abhaken
- Gesamtliste, Friedhof, Auswertung mit Run-Verlauf
- Backup als Text oder Datei, tägliches automatisches Backup per GitHub Action
- Google-Anmeldung: Nur freigeschaltete Konten sehen und bearbeiten das Dashboard, alle anderen eine Willkommensseite
- Design Pokédex für alle; der Admin kann zusätzlich Pastell oder Lovecraft wählen (gemerkt pro Gerät)

## Lokal ausprobieren

```bash
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen. Steht in `config.js` bei `projectId` der Platzhalter `DEIN-PROJEKT` (zum Beispiel nach `python tools/setup.py` ohne Firebase), speichert die Seite nur im Browser.

## Gut zu wissen

- Kosten: Firebase läuft im kostenlosen Spark-Tarif ohne Zahlungsart. Beim Tageslimit stoppt das Speichern bis zum nächsten Tag, es entstehen keine Kosten.
- `config.js` gehört zur jeweiligen Installation (Firebase-Werte, Spieleranzahl, Admin-UID). Die Werte sind bei Firebase-Webseiten immer öffentlich, geschützt wird über `firestore.rules`.
- `firestore.rules` wird aus `firestore.rules.template` erzeugt (`python tools/setup.py --rules`) und in der Firebase-Konsole veröffentlicht.
- Automatisches Backup: Die GitHub Action **Backup** läuft täglich um 03:17 UTC und committet nach `backups/` (`latest.json` plus eine Datei pro Tag mit Änderungen). Von Hand: **Actions > Backup > Run workflow**. Einspielen über **Daten sichern und umziehen > Backup einspielen**. E-Mail-Adressen sind nicht im Backup.
- GitHub pausiert zeitgesteuerte Actions in Repos, in denen 60 Tage lang nichts passiert. Dann kommt eine Mail, und die Action lässt sich unter **Actions** wieder einschalten.

Mehr zum Aufbau: [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md). Offene Ideen: [docs/BACKLOG.md](docs/BACKLOG.md).
