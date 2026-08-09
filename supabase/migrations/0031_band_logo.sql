-- Band-Logo für die Team-App: dient als Bild in der App UND als Icon auf dem
-- Home-Bildschirm (Web-App-Manifest). Bisher waren beide über eine
-- hartcodierte Band-ID→Datei-Zuordnung in constants.ts gelöst; damit hätte
-- jede neue Band von Hand nachgetragen werden müssen.
--
-- Gespeichert wird der Storage-Pfad im ÖFFENTLICHEN Bild-Bucket (mail-bilder):
-- Das Manifest-Icon lädt das Betriebssystem ohne Anmeldung, eine signierte URL
-- wäre nach einer Stunde tot. Ein Bandlogo ist ohnehin öffentlich (Website,
-- Plakate), anders als Verträge/Rider im privaten Bucket.
alter table bands add column logo_pfad text;
