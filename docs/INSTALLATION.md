# Installation für eine eigene Gruppe

Diese Anleitung richtet das Soul-Link-Dashboard für deine Gruppe ein: eigene Seite auf GitHub Pages, eigene Datenbank in Firebase, 2 bis 6 Spieler. Dauer etwa 20 Minuten, Kosten keine.

**Du brauchst:**
- ein GitHub-Konto
- ein Google-Konto (für Firebase und zum Anmelden auf der Seite)
- Python 3 und Git auf deinem Rechner (für das Einrichtungsskript)

Wer nur ausprobieren will, kann Schritt 2 überspringen: Ohne Firebase speichert die Seite alles nur im eigenen Browser.

---

## 1. Eigenes Repo anlegen

1. Die Vorlage <https://github.com/WeissiEfficiency/soul-link-dashboard> öffnen, **Use this template > Create a new repository** klicken, Name z. B. `soul-link`, Sichtbarkeit **Public** (GitHub Pages braucht ohne bezahltes GitHub-Konto ein öffentliches Repo), **Create repository**.
2. Das neue Repo auf deinen Rechner holen:

   ```bash
   git clone https://github.com/DEIN-NAME/soul-link.git
   cd soul-link
   ```

Die Vorlage enthält keine Daten einer anderen Gruppe, nur Platzhalter. Kopierst du stattdessen das Repo einer bestehenden Gruppe (Fork), ersetzt das Einrichtungsskript in Schritt 3 deren Einstellungen und löscht ihre Backups.

## 2. Firebase einrichten

Alles in der [Firebase-Konsole](https://console.firebase.google.com):

1. **Projekt erstellen**, Name z. B. `soul-link`. Google Analytics brauchst du nicht.
2. **Erstellen > Firestore Database > Datenbank erstellen**: Standort `eur3 (europe-west)` oder eine Region in deiner Nähe, **Im Produktionsmodus starten**.
3. **Erstellen > Authentication > Jetzt starten > Google** aktivieren, Support-E-Mail wählen, speichern.
4. **Authentication > Einstellungen > Autorisierte Domains > Domain hinzufügen**: `DEIN-NAME.github.io`.
5. **Zahnrad > Projekteinstellungen > Allgemein > Deine Apps > `</>`** (Web-App): Namen eingeben, **App registrieren** (ohne Firebase Hosting). Den angezeigten Block `const firebaseConfig = { … };` offen lassen oder kopieren, du brauchst ihn gleich.

Der kostenlose Spark-Tarif reicht. Nicht auf Blaze wechseln: Im Spark-Tarif entstehen nie Kosten, beim Tageslimit pausiert nur das Speichern bis zum nächsten Tag.

## 3. Einrichtungsskript ausführen

Im Repo-Ordner:

```bash
python tools/setup.py
```

Das Skript fragt nacheinander:

| Frage | Antwort |
|---|---|
| Firebase-Konfiguration | den Block aus Schritt 2.5 einfügen, dann eine leere Zeile. Nur Enter = ohne Firebase |
| Wie viele Spieler | 2 bis 6 |
| Admin-UID | leer lassen, sie kommt in Schritt 5 |
| Adresse von `backups/latest.json` | Vorschlag mit Enter übernehmen |
| Alte Backups löschen (nur bei einer Kopie mit Backups) | `ja` |

Es schreibt `config.js` und `firestore.rules`. Danach hochladen:

```bash
git add -A
git commit -m "Eigene Einrichtung"
git push
```

## 4. GitHub Pages und Backup einschalten

1. Im Repo auf GitHub **Settings > Pages**: Source **Deploy from a branch**, Branch **main**, Ordner **/ (root)**, **Save**. Nach 1 bis 2 Minuten läuft die Seite unter `https://DEIN-NAME.github.io/soul-link/`.
2. Reiter **Actions**: Steht dort ein Hinweis, dass Workflows ausgeschaltet sind (bei Forks üblich), **I understand my workflows, go ahead and enable them** klicken. Die Action **Backup** sichert die Daten dann jeden Tag nach `backups/`.

## 5. Admin werden

1. Die Seite öffnen und **Mit Google anmelden**.
2. Die Seite meldet „Noch kein Admin eingerichtet“ und zeigt deine Firebase-UID samt fertigem Befehl. Diesen ausführen, zum Beispiel:

   ```bash
   python tools/setup.py --admin AbCdEf123456
   git add -A
   git commit -m "Admin eingetragen"
   git push
   ```

3. Die Firestore-Regeln veröffentlichen: In der Firebase-Konsole **Firestore Database > Regeln**, den gesamten Inhalt durch den Inhalt von `firestore.rules` ersetzen, **Veröffentlichen**.
4. Seite nach 1 bis 2 Minuten neu laden (Strg+F5). Jetzt siehst du das Dashboard.

## 6. Mitspieler freischalten und loslegen

1. Ganz unten **Schreibrechte (nur für dich sichtbar)** öffnen, die Google-E-Mails der Mitspieler eintragen (eine pro Zeile, höchstens 10), **Speichern**.
2. Bei **Spieler** die Namen eintragen.
3. Im Run-Kasten unter **Spiel** euer Spiel wählen (Standard Schwarz & Weiß).
4. Bei **Routen und Fänge** auf **Standard-Routen anlegen** klicken, falls noch keine da sind.
5. Den Link an die Mitspieler schicken. Sie melden sich mit dem eingetragenen Google-Konto an und können alles bearbeiten außer Backup und Freischaltungen.

Wer nicht freigeschaltet ist, sieht nur eine Willkommensseite.

---

## Später ändern

- **Spieleranzahl**: `python tools/setup.py --players 4`, committen, pushen. Neue Spieler bekommen leere Spalten. Bei weniger Spielern bleiben die Daten der übrigen erhalten, werden aber nicht angezeigt. Die Regeln erlauben bis zu 6 Spieler und müssen dafür nicht neu veröffentlicht werden.
- **Spiel**: im Run-Kasten unter **Spiel** (nur für den Admin sichtbar). Solange im Run nichts eingetragen ist, gilt es sofort, sonst ab **Neuer Run starten**. Routen und Level-Caps sind ein Vorschlag und lassen sich auf der Seite ändern.
- **Admin wechseln**: `python tools/setup.py --admin NEUE-UID`, pushen, Regeln neu veröffentlichen.
- **Regeln nach einem Update**: Ändert sich `firestore.rules.template`, `python tools/setup.py --rules` ausführen und die neue `firestore.rules` veröffentlichen.
- **Neue Versionen**: Geänderte Dateien aus der Vorlage übernehmen, außer `config.js`, `firestore.rules` und `backups/` (das sind deine). Bei einem Fork geht das mit **Sync fork**, dabei deine `config.js` behalten. Danach `python tools/setup.py --rules` und die Regeln neu veröffentlichen, falls sich `firestore.rules.template` geändert hat.

## Wenn etwas nicht klappt

| Problem | Lösung |
|---|---|
| „Anmeldung fehlgeschlagen“ | `DEIN-NAME.github.io` unter Authentication > Autorisierte Domains eintragen (Schritt 2.4) |
| Nach dem Anmelden „Kein Zugang“ | Als Admin: Admin-UID eingetragen und gepusht (Schritt 5)? Als Mitspieler: E-Mail unter Schreibrechte eingetragen? |
| Oben „Speichern fehlgeschlagen“ | Regeln aus `firestore.rules` nicht oder in alter Fassung veröffentlicht (Schritt 5.3) |
| Seite zeigt alten Stand | Strg+F5. GitHub Pages braucht nach einem Push 1 bis 2 Minuten |
| Backup-Action schlägt fehl | Firebase-Werte in `config.js` fehlen, oder Actions sind nicht eingeschaltet (Schritt 4.2) |

## Was öffentlich ist

- `config.js` (Firebase-Werte, Admin-UID) ist für jede Firebase-Webseite öffentlich, das ist normal und kein Sicherheitsproblem. Geschützt wird über die Regeln.
- Die Backups in `backups/` liegen öffentlich im Repo: Spielernamen, Pokémon, Routen und Zähler. E-Mail-Adressen stehen nur in Firestore, nie im Repo oder Backup.
- Die Willkommensseite blendet das Dashboard für Fremde aus, die Daten selbst kann aber jeder lesen, der die Firebase-Werte kennt. Wer das nicht möchte, nimmt Spitznamen statt echter Namen.
