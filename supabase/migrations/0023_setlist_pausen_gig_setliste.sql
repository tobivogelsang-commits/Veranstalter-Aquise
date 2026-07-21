-- Set-Zeiten für gebuchte Auftritte:
--
-- 1. setlisten.pausen: Pausen innerhalb einer Setliste als JSON-Liste
--    [{nach_index, minuten}] - eine Pause von X Minuten nach dem Song mit
--    0-basiertem Index nach_index. Dadurch zerfällt die Setliste in "Sets",
--    ohne die bestehende Song-Reihenfolge (setlist_eintraege) anzufassen.
-- 2. venues.gig_setliste_id: die für den Gig eingeplante Setliste. Aus
--    Auftrittsbeginn (gig_beginn) + Songdauern + diesen Pausen werden die
--    Start-/Endzeiten je Set berechnet und gegen gig_ende geprüft.
--
-- Gefahrlos: nur zusätzliche Spalten; pausen hat einen Default, gig_setliste_id
-- ist nullbar und wird bei gelöschter Setliste auf NULL gesetzt.

alter table setlisten
  add column pausen jsonb not null default '[]'::jsonb;

alter table venues
  add column gig_setliste_id uuid references setlisten(id) on delete set null;
