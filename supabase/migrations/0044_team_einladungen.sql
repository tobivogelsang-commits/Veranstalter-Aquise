-- Team-App: Zugang nur noch per Einmal-Link statt offenem Band-Link.
--
-- Bisher konnte sich jede Person mit dem Band-Link selbst eintragen - und
-- ein bestehendes Mitglied OHNE Passwort sogar "uebernehmen", indem sie als
-- Erste eins setzt. Kuenftig erzeugt der Admin in den Einstellungen pro
-- Mitglied einen Einmal-Link (Einladung fuer Neue, Zugangslink zum Passwort
-- setzen fuer Bestehende). Die Anmeldung in der Team-App verlangt Name UND
-- Passwort; ohne Passwort hilft nur der Zugangslink vom Admin.
--
-- Dafuer wird die bestehende einladungen-Tabelle (0043, Desktop-Tool) um
-- Band- und Mitgliedsbezug erweitert - gleiche Mechanik, gleiche Tabelle.

alter table einladungen
  add column band_id uuid references bands (id) on delete cascade,
  add column mitglied_id uuid references band_mitglieder (id) on delete cascade;

alter table einladungen drop constraint einladungen_zweck_check;
alter table einladungen
  add constraint einladungen_zweck_check
  check (zweck in ('einladung', 'passwort_reset', 'team_einladung', 'team_passwort'));

-- Selbstregistrierung ueber den Band-Link gibt es nicht mehr. Die Spalte
-- bleibt vorerst bestehen (kein Code liest sie mehr), wird aber fuer alle
-- Bands geschlossen - falls alter Code irgendwo noch laeuft.
update bands set registrierung_offen = false;
