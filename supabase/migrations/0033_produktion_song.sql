-- Rückweg Produktion -> Songkatalog: Ist ein Song fertig produziert, wird er
-- in den Katalog übernommen (und heißt dort meist anders als der Arbeitstitel:
-- "BlBl176" wird zu "How I Get"). Die Produktion merkt sich den entstandenen
-- Song, damit
--   1. derselbe Song nicht mehrfach im Katalog landet,
--   2. die Karte "im Katalog" anzeigen kann,
--   3. erledigte Produktionen ans Ende der Liste sortiert werden.
--
-- on delete set null: Wird der Katalog-Song später gelöscht, bleibt die
-- Produktion als Historie erhalten und gilt wieder als nicht übernommen.
alter table produktionen
  add column song_id uuid references band_songs(id) on delete set null;
