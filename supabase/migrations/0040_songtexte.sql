-- Songtexte am Katalog-Song, zum Mitlesen auf der Bühne.
--
-- Der Text wird beim ersten Öffnen automatisch bei lrclib.net gesucht und hier
-- abgelegt - danach steht er ohne Netz zur Verfügung, was auf einer Bühne der
-- eigentliche Punkt ist.
--
-- songtext_geholt_am unterscheidet "noch nie gesucht" (null) von "gesucht, aber
-- nichts gefunden" (Zeitstempel gesetzt, songtext null). Ohne das würde bei
-- jedem Öffnen eines textlosen Songs erneut abgefragt.
alter table band_songs
  add column songtext text,
  add column songtext_geholt_am timestamptz;
