# Architektur

## Überblick

Einrichtung für eine neue Gruppe: `docs/INSTALLATION.md` und `tools/setup.py` (schreibt `config.js`, erzeugt `firestore.rules`, setzt Admin-UID und Spieleranzahl, leert `backups/`).


Statische Seite ohne Build. `index.html` lädt `config.js`, `js/games.js`, `js/pokemon.js`, `js/evo.js`, `js/types.js` und `js/app.js`. Beim Start wählt `app.js` einen Speicher-Adapter:

| Modus | Bedingung | Speicher |
|---|---|---|
| Firebase | `config.js` enthält echte Werte (nicht `DEIN-PROJEKT`) | Firestore, live für alle |
| Artifact | Seite läuft auf claude.ai (`window.claude` vorhanden) | Artifact-Datenbank |
| Lokal | sonst, oder wenn Firebase nicht lädt | `localStorage` dieses Browsers |

Alle Adapter bieten dieselben Funktionen: `watchDoc`, `watchCol`, `merge`, `set`, `del`. Der Rest der App kennt den Modus nicht.

## Datenmodell

Drei Sammlungen. Spieler-Schlüssel `p0` … `p5`; wie viele es sind, steht in `config.js` (`playerCount`, 2 bis 6, Standard 3). In `app.js` stehen sie in `P`, die Indizes in `IDX`, die Anzahl in `NP`; `perPlayer()` baut Standardwerte, `buildPlayerUI()` die spielerabhängigen Tabellenköpfe und Run-Ender-Knöpfe. Ab 5 Spielern brechen Routenzellen und Spielerkarten in Zeilen zu drei um (`--np-cols`). Spielernamen stehen nur in `meta.players`, ohne Namen zeigt die Seite „Spieler 1“ usw.

**`meta/main`**
```
players: { p0: { name } , ... }
run:     { no, status: "run"|"lost"|"won", enders: { p0: bool, ... }, where, cause }   // "won" nur per Admin-Knopf
tally:   { p0: { run, death, enc }, ... }      // Basiswerte abgeschlossener Runs
caps:    { beaten: { g1: bool, ... }, lv: { g1: Zahl, ... } }   // lv = manuelle Abweichung
backupAt: ISO-Zeitpunkt der letzten Sicherung oder ""      // gesetzt von „Backup kopieren“ / „Als Datei speichern“
game:     Spiel-ID aus js/games.js, z. B. "pt"           // fehlt = "bw" (Schwarz/Weiß)
nextGame: Spiel-ID für den nächsten Run oder ""
```

**`routes/<id>`** (eine pro Route)
```
order, name, nick, extra?, hint?, custom?, team?          // team: Link steht im Team (zählt nur, solange er lebt)
cells:  { p0: { sp, st: ""|"alive"|"dead"|"miss" }, ... }   // sp = Pokémon, optional
killer: Spielerindex 0–5 oder -1                              // Encounter getötet von
deaths: { p0: bool, ... }                                     // Tod bei
cause
```
Ältere Routen haben den Spitznamen in `cells.pX.nick`; `nickOf()` liest ihn als Rückfall.

Routen-Status (`status()`): `miss` vor `dead` vor `alive`/`part`/`open`. Verpasst (`miss`) heißt, der Encounter ist verloren: Klick auf ∅ setzt die lebenden Pokémon der anderen auf `dead`, Zurücknehmen belebt sie wieder (außer wer unter „Tod bei“ steht). `dead` und `miss` sind verlorene Links (`isLost()`), stehen im Friedhof und in `history.deadLinks` (bei `miss` mit `killer` = erster, der nicht gefangen hat, und `cause` „nicht gefangen“).

**Run-Status (`runState()`)**: „Verloren“ setzt der Knopf „Run verloren“ (`run.status = "lost"`, „Doch nicht verloren“ setzt zurück). „Gewonnen“ setzt entweder der Admin per Knopf „Run gewonnen“ (`run.status = "won"`, sichtbar nur bei `backupAllowed()`, also Admin bzw. Lokal-/Artifact-Modus; „Doch nicht gewonnen“ setzt zurück), oder es ergibt sich ohne Speichern, sobald jede Route außer dem Fossil gespielt ist (`played()`: Status nicht `open` und nicht `part`). „Neuer Run starten“ erscheint nur bei verloren oder gewonnen und schreibt den abgeleiteten Status in `history`. Wechselt der Status während die Seite offen ist auf gewonnen, startet `fireworks()` (Canvas, ca. 9 s, Farben aus den Theme-Variablen, aus bei `prefers-reduced-motion`). Erst zerplatzt eine Rakete zum Pokéball aus `FW_SHAPES` (Buchstaben K/R/W/Y = `--ink`, `--pink`, `--surface`, `--lemon`), danach je eine zu den Figuren der überlebenden Pokémon: `winDex()` nimmt je Spieler bis zu zwei zufällige Pokémon aus komplett lebenden Links (Name per `dexOf()` auf die Dex-Nummer), `spriteShape()` lädt das Sprite von PokeAPI (`SPRITE_URL` Schwarz/Weiß bis #649, sonst `SPRITE_URL_NEW`; raw.githubusercontent.com, CORS offen) und rastert es auf höchstens 44 Pixel. Lädt ein Sprite nicht oder fehlen Pokémon-Namen, springt das Pikachu aus `FW_SHAPES` ein.

**`history/<id>`** (eine pro abgeschlossenem Run, angelegt bei „Neuer Run starten“)
```
no, status, enders, where, cause, endedAt, badges, lastCap, links, game?,
deadLinks: [{ route, nick, mons[Spieleranzahl], killer, deaths, cause }],
perPlayer: { p0: { run, death, enc }, ... }
```

## Spiele

`js/games.js` legt `window.SOULLINK_GAMES` an: alle Hauptspiele von Rot/Blau bis Karmesin/Purpur (ohne Legenden-Spiele), je mit `id`, `name`, `title`, `region`, `gen`, `maxDex` (+ `extraDex`, z. B. Meltan/Melmetal bei Let's Go), `boost` (Dex-Bereich, den die Suche bevorzugt), `routes` und `caps`. Routen bekommen IDs `r01` … in Listenreihenfolge, Schwarz/Weiß behält seine festen alten IDs (`r42`, `r43`). Cap-IDs (`g1` … `g8`, `e4`, `ch`, `x1`, bei Schwarz/Weiß `n`, `gc`) sind über alle Spiele gleich, weil `caps.beaten` und `caps.lv` in den Regeln höchstens 20 Einträge haben dürfen.

- `gameId()` / `GAME()` lesen `meta.game` (fehlt = `bw`). `caps()`, `seedRoutes()`, `search()` (nur Pokémon bis `maxDex`), `tt()` (Region im Untertitel) und `renderGame()` (Titel, Überschrift, Auswahl) hängen daran.
- **Wechsel** nur durch den Admin (`backupAllowed()`, Auswahl `#gameSel` im Run-Kasten): Ist im Run nichts eingetragen (`runEmpty()`), wechselt `switchGame()` sofort. Sonst merkt sich `meta.nextGame` das Spiel, und „Neuer Run starten“ wechselt nach dem Eintrag in `history`. `switchGame()` schreibt die Routen des neuen Spiels (gleiche IDs werden überschrieben), löscht die übrigen (auch eigene Routen) und setzt alle Caps samt eigener Level zurück (`lv` auf 0 = Standard).
- `history.game` wird nur geschrieben, wenn `meta.game` gesetzt ist; alte Runs ohne Feld gelten als Schwarz/Weiß. Die Auswertung zeigt das Spiel unter der Run-Nummer.
- Feuerwerk: Sprites bis #649 aus Schwarz/Weiß, danach die Standard-Sprites von PokeAPI (`SPRITE_URL_NEW`).
- Routen und Level sind ein Vorschlag (Level = stärkstes Pokémon des Gegners, Arenaleiter-Namen nach PokéWiki). Korrekturen gehören in `js/games.js`, nicht in die Datenbank.

## Team, Sprites, Dupes

- **Team**: Knopf „☆ Ins Team“ an jeder komplett lebenden Route setzt `routes/<id>.team`. `onTeam()` zählt nur lebende Links, höchstens sechs (`teamIds()`); stirbt ein Link, fällt er automatisch heraus. „Neuer Run starten“ setzt `team` überall zurück. `renderTeam()` zeigt die Leiste `#team` mit Sprites und Typen je Spieler.
- **Typen**: aus `typesOfName()` (Daten der Schwächen-Karte, richtet sich nach der Generation des Spiels). `teamClashes()` meldet pro Spieler zwei Team-Pokémon mit gleichem Primärtyp (`#teamWarn`), nur als Hinweis.
- **Dupes**: `earlierCatch()` sucht pro Spieler eine frühere Route (kleinere `order`), in der er ein Pokémon derselben Entwicklungsreihe (`POKE_CHAIN` aus `js/evo.js`) gefangen hat (lebt oder tot). Die Zelle zeigt dann „⚠ Dupe“, gesperrt wird nichts.
- **Sprites in Zellen**: `cellExtras()` setzt Sprite (`spriteUrl()`, Schwarz/Weiß-Sprites bis #649, sonst Standard-Sprites von PokeAPI) und Typ-/Dupe-Zeile, sobald der Name einem Pokémon entspricht (`dexOf()`, kennt auch Regionalformen).
- `js/evo.js` ist aus der PokeAPI-Datei `pokemon_species.csv` (`evolution_chain_id`) erzeugt; nicht von Hand ändern.

## Schwächen-Karte

Bereich „Schwächen“ unter den Level-Caps. Reiner Anzeige-Zustand (`wk` in `js/app.js`), nichts wird gespeichert, keine Firestore-Regeln betroffen; funktioniert in allen Modi und auch ohne Schreibrecht.
- **Daten**: `js/types.js` (aus den PokeAPI-CSV-Dateien erzeugt, nicht von Hand bearbeiten) mit `POKE_TYPES` (zwei Zeichen je Dex-Nummer, `a` = Normal … `r` = Fee, `-` = kein Zweittyp), `POKE_TYPES_PAST` (frühere Typen, z. B. vor der Fee) und `POKE_FORMS` (Regionalformen Alola, Galar, Hisui, Paldea mit eigener Typ-Kombination).
- **Typentabelle**: `EFF` (Stand ab Gen 6), `chart(gen)` leitet daraus die Tabellen für Gen 1 (15 Typen, alte Ausnahmen) und Gen 2 bis 5 (17 Typen, Stahl widersteht Geist und Unlicht) ab. Maßgeblich ist `gen` des gewählten Spiels.
- **Eingabe**: Pokémon über dieselbe Vorschlagsliste wie die Routen (`showPk(inp, Einträge)`, `wkSearch()` ergänzt Regionalformen) oder ein bis zwei Typ-Knöpfe.
- **Ausgabe** (`renderWk()`): Angriffstypen nach Faktor, was die Typen des Gegners hart treffen, welche Typen alles aushalten, und „Euer Team“: für jedes lebende Pokémon des Runs (`typesOfName()`, auch „Alola-Vulpix“) der beste Faktor der eigenen Typen und der härteste Treffer vom Typ des Gegners, mit Tipp je Spieler. Fähigkeiten und Items sind nicht eingerechnet.
- Typfarben als `--ty0` … `--ty17` in `:root`, Bausteine setzen `--tyc`.

## Designs (Themes)

Drei Designs mit denselben Bausteinen: `pokedex` (Standard für alle), `pastell`, `lovecraft`. Gesetzt als `<html data-theme="…">` (im Markup steht `pokedex`).
- **Wer wählen darf**: nur der Admin (Firebase-Modus) bzw. jeder im Lokal- und Artifact-Modus (`themeChoiceAllowed()`). Nur dann ist der Umschalter `#themeSeg` sichtbar. Alle anderen bekommen nach der Anmeldeprüfung immer `pokedex` (`applyThemeRole()`, aufgerufen aus `applyRole()`).
- **Gemerkt** pro Gerät in `localStorage` (`soullink-theme`), nicht in der Datenbank. Ein kleines Skript im `<head>` setzt ein gespeichertes `pastell`/`lovecraft` vor dem ersten Zeichnen, damit es beim Admin nicht flackert; bei allen anderen schaltet `applyThemeRole()` nach der Anmeldeprüfung auf Pokédex zurück.
- **Farben, Schriften, Formen**: nur über CSS-Variablen in `:root` (z. B. `--ink`, `--surface`, `--hdr`, `--mark`) und je Theme einen Block `:root[data-theme=…]` am Ende von `css/style.css`. Keine festen Farben in Bausteinen, neue Flächen bekommen eine Variable.
- **Sprüche**: `THEME_TXT` in `js/app.js` (Untertitel, Run-Zeile, leerer Friedhof), abgerufen mit `tt(key)`; `{R}` wird durch die Region des Spiels ersetzt.
- Neues Theme: Eintrag in `THEMES` und `THEME_TXT`, Knopf in `#themeSeg`, CSS-Block. Schriften im Google-Fonts-Link in `index.html` (werden nur geladen, wenn sie genutzt werden).

## Anmeldung und Rechte (nur Firebase-Modus)

Zum Ansehen und Schreiben meldet man sich mit Google an (`signInWithPopup`, Rückfall auf Redirect). Bis die Anmeldung geklärt ist und für alle ohne Freigabe zeigt die Seite nur die Willkommensseite `#gate` (`setGate()`: `load`, `out` = nicht angemeldet, `no` = Konto nicht freigeschaltet; `body.gated` blendet den Rest aus). Erst nach der Freigabe abonniert `onAuth()` die Daten (`subscribe()`); wird jemand danach abgemeldet, lädt die Seite neu. Achtung: Die Firestore-Regeln erlauben das Lesen weiterhin jedem, die Sperre ist also ein Sichtschutz der Seite, kein Schutz der Daten (siehe Backlog T-015).
- **Admin**: UID steht in `config.js` (`adminUid`) und in `firestore.rules` (`isAdmin`), beide gesetzt von `python tools/setup.py --admin`. Sieht zusätzlich Backup, Backup-Erinnerung, „Run gewonnen“ und „Schreibrechte“. Ist noch kein Admin eingetragen, zeigt die Willkommensseite angemeldeten Nutzern ihre UID und den passenden Befehl.
- **Freigeschaltet**: Google-E-Mail (kleingeschrieben, bestätigt) steht in `access/main.emails` (max. 10). Darf alles außer Backup.
- **Sonst**: Willkommensseite, kein Dashboard.

Ob jemand freigeschaltet ist, erkennt die Seite daran, dass sie `access/main` lesen darf (`onAuth()`). Die Rolle setzt `setCanWrite()` / `applyRole()`; bei Wechsel werden die Routenzeilen neu gebaut. Im Artifact- und Lokal-Modus gibt es keine Anmeldung, dort bleibt alles wie zuvor.

**`access/main`**
```
emails: [ "name@gmail.com", ... ]   // nur Admin schreibt, lesbar für Freigeschaltete
```

## Firestore-Regeln

Quelle ist `firestore.rules.template` (Platzhalter `__ADMIN_UID__`); `python tools/setup.py --rules` erzeugt daraus `firestore.rules` mit der UID aus `config.js`. Die Regeln erlauben immer bis zu sechs Spieler (`p0` … `p5`, `killer` bis 5), eine andere Spieleranzahl braucht also keine neuen Regeln. `firestore.rules` prüft bei jedem Schreiben zuerst `isWriter()` (siehe oben) und dann jedes Dokument gegen dieses Datenmodell: nur bekannte Felder, Textlängen begrenzt, Status-Werte aus festen Listen, Routen-IDs `r00`–`r99` oder `c…`, `meta` nur als `main`. `meta` und `history` sind nicht löschbar, `history` ist nach dem Anlegen unveränderlich (gleiche Daten erneut schreiben ist erlaubt, damit Backups eingespielt werden können). Ein neues Feld braucht deshalb vier Schritte: Standardwert in `defMeta()` bzw. beim Anlegen der Route, `firestore.rules.template`, `python tools/setup.py --rules`, und die Regeln neu in der Firebase-Konsole veröffentlichen.

## Backups

- **Von Hand**: „Backup kopieren“ / „Als Datei speichern“ (nur Admin) setzen `meta.backupAt`.
- **Automatisch**: GitHub Action `.github/workflows/backup.yml` ruft täglich `tools/backup.py` auf. Das Skript liest `meta`, `routes`, `history` über die Firestore-REST-API (Lesen ist offen, Projekt-ID und API-Key aus `config.js`), schreibt im Exportformat von `exportData()` (`app`, `version`, `exportedAt`, `meta`, `routes`, `history`, zusätzlich `source: "auto"`) nach `backups/latest.json` und `backups/JJJJ-MM-TT.json` und nur, wenn sich der Inhalt geändert hat. Leere Routen brechen ab, damit kein leeres Backup das letzte gute ersetzt.
- **Erinnerung**: `renderBk()` lädt `config.js autoBackupUrl` (raw.githubusercontent.com, unabhängig vom Pages-Build) und zeigt den Hinweis nur, wenn das jüngere der beiden Backups mindestens 7 Tage alt ist (`BK_DAYS`) und die aktuellen Daten vom automatischen Backup abweichen (`autoBkCurrent()`, Vergleich per `canon()` ohne `backupAt`).

## Zählung

Angezeigter Gesamtstand = `tally` (Basis) + Live-Werte des aktuellen Runs:
- Run +1 für jeden markierten Run-Ender, wenn der Status „Verloren“ ist
- Death +1 je toter Route, bei der der Spieler unter „Tod bei“ markiert ist
- Encounter +1 je toter Route, bei der der Spieler „Encounter getötet von“ ist, und je verpasster Route, bei der der Spieler ∅ hat (mehrere Spieler möglich)

Manuelles Ändern schreibt `tally = gewünschter Wert − Live-Wert`. „Neuer Run starten“ addiert die Live-Werte in `tally`, legt `history` an und leert Routen und Caps.

## Versionen und Browser-Cache

GitHub Pages schickt `Cache-Control: max-age=600`. Damit ein Browser nach einem Deploy keine neue `index.html` mit einer alten `js/app.js` kombiniert, tragen CSS und Skripte in `index.html` `?v=<Version>`, `<html>` trägt `data-v`, und `js/app.js` hat `APP_V`. Weichen `data-v` und `APP_V` ab, lädt `app.js` die Seite einmal neu (Merker in `sessionStorage`). Alle drei Stellen setzt `python tools/bump.py`. Fehlt `data-v` (z. B. als Artifact), passiert nichts.

## Schreiben

`patchRoute()` und `patchMeta()` sammeln Änderungen und schreiben nach 450 ms als Teil-Update (Merge). Während ein Schreibvorgang läuft, werden eingehende Snapshots für dieses Dokument ignoriert, damit Eingaben nicht überschrieben werden. Gleichzeitiges Bearbeiten verschiedener Felder durch mehrere Spieler funktioniert; beim selben Feld gewinnt der letzte.

## Pokémon-Suche

`search()` normalisiert Umlaute und Sonderzeichen und bewertet: exakter Treffer, Präfix, Teilstring, lautähnliche Schreibweise (ph/f, ck/k, z/s …), dann Tippfehler per Damerau-Levenshtein. Gen-5-Pokémon bekommen einen kleinen Bonus. Zahlen suchen nach Dex-Nummer.
