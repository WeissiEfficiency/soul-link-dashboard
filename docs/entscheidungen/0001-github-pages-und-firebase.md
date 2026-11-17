# 0001 – GitHub Pages mit Firebase statt claude.ai oder Google Drive

**Datum:** 2026-11-16
**Status:** angenommen

## Kontext

Das Dashboard entstand als claude.ai-Artifact. Dort brauchen alle Mitspieler einen claude.ai-Account, um einzutragen. Die Mitspieler sollen die Seite ohne claude.ai-Account öffnen und bearbeiten können, und sie soll genauso aussehen wie bisher.

## Entscheidung

Statische Seite auf GitHub Pages, gemeinsamer Speicher in Firebase Firestore mit offenen Regeln, beschränkt auf die drei Sammlungen des Dashboards. Nur der Admin braucht Accounts (GitHub, Google).

## Verworfene Optionen

- **Google Drive:** zeigt HTML-Seiten nicht als Webseite an.
- **Google Sheets:** kein eigenes Design, kein automatisches Zählen.
- **claude.ai-Artifact allein:** Mitspieler bräuchten einen Account.
- **Firebase mit anonymer Anmeldung:** schützt nicht mehr als offene Regeln, weil sich jeder anonym anmelden kann, macht aber die Einrichtung komplizierter.

## Folgen

- Wer den Link kennt, kann Daten ändern oder löschen. Deshalb gibt es Backups (kopieren, als Datei speichern, einspielen).
- Die Seite funktioniert weiter als claude.ai-Artifact und lokal, weil die App über Speicher-Adapter arbeitet.
