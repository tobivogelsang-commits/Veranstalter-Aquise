-- Erweiterungen zum gebuchten Auftritt (ergänzt 0021):
--
-- 1. gig_ende: Ende der Veranstaltung. Manche Clubs dürfen Live-Musik nur bis
--    zu einer bestimmten Uhrzeit spielen - dient später auch als Grenze für
--    die berechneten Set-Zeiten.
-- 2. gig_ansprechpartner: mehrere Ansprechpartner vor Ort (Techniker,
--    Veranstalter, Crew, ...) als JSON-Liste [{rolle, name, telefon}].
--    Ersetzt fachlich die Einzelfelder gig_kontakt_name/gig_kontakt_telefon
--    aus 0021; diese bleiben (leer/unbenutzt) bestehen, um destruktive
--    Änderungen zu vermeiden - das Formular übernimmt einen evtl. vorhandenen
--    Alt-Wert beim ersten Laden in die Liste.
--
-- Gefahrlos: nur zusätzliche Spalten; die Liste hat einen Default.

alter table venues
  add column gig_ende time,
  add column gig_ansprechpartner jsonb not null default '[]'::jsonb;
