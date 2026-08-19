-- Eigenes Timing für den mitlaufenden Text.
--
-- Die Zeitmarken von lrclib gehören zur Original-Aufnahme. Live spielt eine
-- Band schneller oder langsamer, kürzt das Intro oder hängt eine Strophe an -
-- danach läuft der Text am Gesang vorbei. Zwei Wege, das zu richten:
--
--  * songtext_sync_eigen: Beim Proben einmal mitgetippte Zeiten. Bildet die
--    eigene Fassung ab, auch bei abweichendem Aufbau. Format wie
--    songtext_sync (LRC); null = die Fassung von lrclib gilt.
--  * versatz/tempo: Schnellkorrektur ohne Einlernen - alles um X Millisekunden
--    verschieben und/oder gleichmäßig strecken/stauchen. Wirkt auf die jeweils
--    gültige Fassung, also auch auf eine eingelernte.
--
-- tempo in Prozent (100 = unverändert, 105 = wir spielen 5 % schneller, die
-- Zeilen kommen also früher). Als Ganzzahl, weil ein Prozentschritt fein genug
-- ist und Nachkommastellen nur Rundungsfragen aufwerfen.
alter table band_songs
  add column songtext_sync_eigen text,
  add column songtext_versatz_ms integer not null default 0,
  add column songtext_tempo integer not null default 100,
  add constraint band_songs_songtext_tempo_bereich
    check (songtext_tempo between 50 and 200);
