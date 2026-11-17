# 0002 – Ein Spitzname pro Route

**Datum:** 2026-11-16
**Status:** angenommen

## Kontext

Die verlinkten Pokémon einer Route tragen bei uns denselben Spitznamen. Ein Spitznamen-Feld pro Spieler und Route waren unnötige Tipparbeit. Das Pokémon selbst einzutragen ist zu viel Aufwand, um es zur Pflicht zu machen.

## Entscheidung

Ein gemeinsames Feld `nick` pro Route. Das Pokémon (`sp`) bleibt pro Spieler, ist aber optional. Spitzname eintragen setzt alle noch leeren Zellen auf „lebt“.

## Folgen

Ältere Daten mit Spitznamen in `cells.pX.nick` werden über `nickOf()` weiter angezeigt und beim nächsten Bearbeiten ins neue Feld übernommen.
