-- Details zu einem gebuchten Auftritt ("gebuchter Auftritt").
--
-- Diese Felder werden erst relevant, wenn der Veranstalter in der Pipeline auf
-- Status "gebucht" landet. Sie hängen am Veranstalter (venues), da auch das
-- Veranstaltungsdatum dort liegt (0006) - ein Veranstalter = ein Gig-Datum.
--
-- Angezeigt werden sie auf der Veranstalterkarte (Desktop) und in der Team-App
-- (Tipp auf den Veranstalter unter "Nächste Termine" bzw. im Kalender).
--
-- Gefahrlos: nur zusätzliche, nullbare Spalten.

alter table venues
  add column gig_einlass time,          -- Load-in / Einlass
  add column gig_soundcheck time,       -- Soundcheck
  add column gig_beginn time,           -- Auftrittsbeginn
  add column gig_zeiten_notiz text,     -- Set-Zeiten, Ende, sonstige Zeit-Hinweise
  add column gig_logistik text,         -- Parken, Backstage, Strom/Bühne, Dresscode, Anfahrt
  add column gig_kontakt_name text,     -- Ansprechpartner vor Ort (kann vom Veranstalter-Kontakt abweichen)
  add column gig_kontakt_telefon text;  -- Handynummer des Ansprechpartners vor Ort
