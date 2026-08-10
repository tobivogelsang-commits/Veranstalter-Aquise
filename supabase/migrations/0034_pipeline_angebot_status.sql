-- Zwei neue Pipeline-Schritte zwischen "Bereit zu buchen" und "Gebucht":
--   angebot_verschickt  - Angebot ist raus, wir warten auf Antwort
--   angebot_nachfassen  - keine Reaktion, es ist Zeit hinterherzutelefonieren
--
-- Hinweis: Der in Migration 0009 gesetzte CHECK-Constraint existiert in der
-- Datenbank nicht mehr (irgendwann entfernt worden, siehe "if exists" unten) -
-- die Spalte war zuletzt also ungeprüft und akzeptierte beliebige Texte.
-- Hier wird er zusammen mit den neuen Werten wiederhergestellt, damit
-- Tippfehler wieder auffallen.
alter table venue_band_status drop constraint if exists venue_band_status_status_check;

alter table venue_band_status add constraint venue_band_status_status_check
  check (status in (
    'neu', 'recherchiert', 'kontaktiert', 'nachgefasst',
    'interessiert', 'bereit_zu_buchen',
    'angebot_verschickt', 'angebot_nachfassen',
    'abgesagt', 'gebucht'
  ));
