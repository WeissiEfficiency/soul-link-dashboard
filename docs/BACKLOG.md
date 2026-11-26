# Backlog

## Aktueller Stand

Seite ist fertig und läuft auf GitHub Pages mit Firebase (Firestore, Regeln aus `firestore.rules` veröffentlicht). Die Firestore-Regeln prüfen das Datenmodell, die Seite erinnert an Sicherungen, Ansehen und Schreiben gehen nur mit Google-Anmeldung und Freigabe durch den Admin, und eine GitHub Action sichert täglich nach `backups/`. Spieleranzahl 2 bis 6 über `config.js`; der Admin wählt das Spiel (Gen 1 bis 9, gilt ab dem nächsten Run). Andere Gruppen richten eigene Kopien mit `tools/setup.py` ein (`docs/INSTALLATION.md`).

**Nächster Schritt:** T-009 (Google-E-Mails der Mitspieler unter „Schreibrechte“ eintragen), dann T-004.

## Aufgaben

| ID | Aufgabe | Prio | Status | Meilenstein |
|---|---|---|---|---|
| T-001 | Firebase-Projekt anlegen, Regeln aus `firestore.rules` setzen, Werte in `config.js` | hoch | erledigt | M1 |
| T-002 | GitHub Pages aktivieren (Settings > Pages > main, root) | hoch | erledigt | M1 |
| T-003 | Backup aus claude.ai kopieren und auf der GitHub-Seite einspielen | hoch | erledigt | M1 |
| T-004 | Link an die Mitspieler schicken, gemeinsam testen | mittel | offen | M1 |
| T-005 | Dupe-Hinweis, wenn eine Art im Run schon gefangen wurde (falls ihr die Regel spielt) | niedrig | erledigt (pro Spieler, ganze Entwicklungsreihe) | M2 |
| T-006 | Automatischer Smoke-Test (Playwright) für Eintragen, Tod, Neuer Run | niedrig | Idee | M2 |
| T-007 | Regelmäßiges Backup erinnern (z. B. Hinweis, wenn letzte Sicherung alt ist) | niedrig | erledigt | M2 |
| T-008 | Firebase App Check (reCAPTCHA), damit nur die eigene Seite schreiben darf | niedrig | verworfen (durch Anmeldung erledigt) | M2 |
| T-010 | Automatisches tägliches Backup per GitHub Action nach `backups/` | mittel | erledigt | M2 |
| T-011 | Designs: Pokédex für alle, Pastell und Lovecraft zum Umschalten nur für den Admin | niedrig | erledigt | M2 |
| T-012 | Routen nacheinander einblenden, „Route hinzufügen“ unter der Liste | mittel | erledigt | M2 |
| T-013 | Run-Status automatisch (Verloren-Knopf, Sieg mit Feuerwerk), Verpasst wie Tod | mittel | erledigt | M2 |
| T-014 | Willkommensseite statt Dashboard für nicht freigegebene Konten | mittel | erledigt | M2 |
| T-015 | Firestore-Lesen auf freigegebene Konten beschränken (Backup-Action braucht dann eigenen Zugang, öffentliche Backups im Repo bedenken) | mittel | offen | M2 |
| T-016 | Anonymisiert, Spieleranzahl 2 bis 6, Einrichtungsskript und Installationsanleitung für andere Gruppen | mittel | erledigt | M2 |
| T-017 | Saubere Vorlage ohne eigene Daten und Git-Verlauf (Template-Repo `soul-link-dashboard`); Änderungen am Code dort nachziehen | niedrig | erledigt | M2 |
| T-018 | Spiele-Schalter für den Admin: alle Hauptspiele Gen 1 bis 9 mit Routen, Level-Caps, 1025 Pokémon; gilt ab dem nächsten Run | mittel | erledigt (Regeln veröffentlichen) | M2 |
| T-019 | Routen und Level-Caps der neuen Spiele beim Spielen prüfen und in `js/games.js` korrigieren (v. a. Alola, Galar, Paldea, Let's Go) | niedrig | offen | M2 |
| T-020 | Schwächen-Karte: Gegner-Pokémon oder Typen wählen, Angriffstypen, Gefahren und passende Pokémon des Teams, Typentabelle je Generation | mittel | erledigt | M2 |
| T-021 | Team (bis 6 Links) mit Leiste, Sprites und Typen in den Routen, Hinweis bei gleichem Primärtyp im Team | mittel | erledigt | M2 |
| T-009 | Google-E-Mails der Mitspieler unter „Schreibrechte“ eintragen | hoch | offen | M1 |

## Erledigt

- Routen, Fänge, Tode, Friedhof, Gesamtliste
- Run-Zähler (Run, Death, Encounter) mit Startwerten aus der Google-Tabelle
- Level-Caps, Auswertung, Backup, Pokémon-Suche
- Ein Spitzname pro Route
