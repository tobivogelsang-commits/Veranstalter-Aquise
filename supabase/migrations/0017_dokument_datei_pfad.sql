-- Storage-Härtung: Der Bucket "email-anhaenge" wird privat. Damit ist die
-- bisher gespeicherte öffentliche URL wertlos - stattdessen merken wir uns den
-- Storage-Pfad und erzeugen beim Anzeigen jeweils eine kurzlebige signierte
-- URL. Die Spalte heißt deshalb nicht mehr datei_url, sondern datei_pfad.
--
-- Gefahrlos: Die Spalte enthält aktuell keine Werte (kein Dokument hat eine
-- hinterlegte Datei), es gehen also keine Daten verloren.
--
-- Ausrollen: Reihenfolge unkritisch, da die Dokument-Datei-Funktion bisher
-- ungenutzt ist. Zusätzlich müssen in Supabase Storage
--   - "email-anhaenge" auf PRIVAT gestellt und
--   - ein neuer ÖFFENTLICHER Bucket "mail-bilder" angelegt werden
-- (Inline-Bilder im Mailtext brauchen dauerhaft öffentliche URLs).

alter table band_dokument_typen
  rename column datei_url to datei_pfad;
