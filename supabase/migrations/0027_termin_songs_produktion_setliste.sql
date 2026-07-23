-- "Songs zum Proben" erweitert: Ein Eintrag kann jetzt statt eines
-- Katalog-Songs auch eine Produktion (unfertiger Song aus dem Produktion-Tab,
-- angezeigt mit ihrem Speichernamen) oder eine ganze Setliste (angezeigt nur
-- mit ihrem Namen) sein. Genau eine der drei Referenzen ist gesetzt; die
-- Reihenfolge (position) läuft über alle Typen gemeinsam. Gelöschte
-- Produktionen/Setlisten verschwinden per Cascade automatisch aus Probenlisten.
--
-- Gefahrlos ausrollbar: song_id wird nur nullable, bestehende Zeilen bleiben
-- gültig (song_id gesetzt, neue Spalten null).
alter table termin_songs
  alter column song_id drop not null,
  add column produktion_id uuid references produktionen(id) on delete cascade,
  add column setliste_id uuid references setlisten(id) on delete cascade,
  add constraint termin_songs_genau_eine_referenz
    check (num_nonnulls(song_id, produktion_id, setliste_id) = 1);
