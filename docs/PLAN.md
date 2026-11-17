# Plan

## Ziel

Ein gemeinsames Dashboard für einen Soul Link mit 2 bis 6 Spielern in einem Pokémon-Hauptspiel (Standard Schwarz/Weiß). Es ersetzt die Google-Tabelle und hält fest, was pro Route gefangen wurde, wer welchen Encounter und welchen Run beendet hat, und wie sich die Gruppe über viele Runs schlägt.

## Hausregeln, die das Dashboard abbildet

- Pro Route ein Encounter je Spieler, die Pokémon aller Spieler sind verlinkt und tragen denselben Spitznamen.
- Stirbt eines, sterben die verlinkten mit. Das zählt als **ein** Encounter (für den Spieler, der ihn getötet hat).
- **Death:** Jeder Spieler, dessen Pokémon im Kampf fällt, bekommt einen Tod. Fallen in einem Kampf zwei Pokémon bei zwei Spielern, bekommen beide einen.
- **Run:** Sterben zwei Spieler beim selben Trainer, gelten beide als Run-Ender.
- **Fossil** ist ein Extra-Encounter, aber nur, wenn alle eines finden.
- Typ-Überschneidungen im Team spielen keine Rolle.

## Umfang (erledigt)

- Routen, Fänge, Tode, Friedhof, Gesamtliste
- Run-Zähler mit automatischer und manueller Zählung
- Level-Caps, Auswertung, Backup
- Live-Sync ohne Account für die Mitspieler (GitHub Pages + Firebase)

## Nicht-Ziele

- Feine Rechteverwaltung: Freigeschaltete dürfen alles außer Backup und Freischaltungen.
- Team- und Typ-Prüfung, Encounter-Tabellen pro Route.

## Meilensteine

- **M1 – Online für alle:** Firebase eingerichtet, GitHub Pages aktiv, Daten aus claude.ai umgezogen. Ergebnis: Alle Mitspieler tragen über den Link ein.
- **M2 – Komfort:** Ideen aus dem Backlog nach Bedarf.
