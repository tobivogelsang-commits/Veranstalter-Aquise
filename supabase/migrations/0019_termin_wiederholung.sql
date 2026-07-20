-- Wiederkehrende Termine + Zu-/Absage pro einzelnem Vorkommen.
--
-- Erweitert 0018: Ein Termin kann sich wiederholen (wöchentlich / 14-tägig /
-- monatlich), damit z. B. eine feste Probe nicht Woche für Woche einzeln
-- angelegt werden muss. `wiederholung_bis` begrenzt die Serie optional; ist es
-- leer, läuft sie offen weiter (im Kalender jeweils bis zum sichtbaren
-- Bereich expandiert - es werden keine echten Zeilen pro Vorkommen gespeichert).
--
-- Bestätigt wird jedes Vorkommen einzeln (jede Woche neu, wie bei den Gigs):
-- termin_antworten bekommt deshalb ein `vorkommen_datum`. Die Eindeutigkeit
-- gilt jetzt je (Termin, Vorkommen-Datum, Mitglied).
--
-- Gefahrlos: kalender_termine/termin_antworten sind noch leer (0018 gerade erst
-- angelegt), daher lassen sich Spalten/Constraints ohne Datenmigration ändern.

alter table kalender_termine
  add column wiederholung text not null default 'einmalig'
    check (wiederholung in ('einmalig', 'woechentlich', 'zweiwoechentlich', 'monatlich')),
  add column wiederholung_bis date;

alter table termin_antworten
  add column vorkommen_datum date;

-- Tabelle ist leer -> direkt NOT NULL setzen (kein Backfill nötig).
alter table termin_antworten
  alter column vorkommen_datum set not null;

-- Alte Eindeutigkeit (termin_id, mitglied_id) durch die vorkommen-genaue
-- ersetzen. Der alte Constraint-Name ist der von Postgres vergebene Default.
alter table termin_antworten
  drop constraint if exists termin_antworten_termin_id_mitglied_id_key;

alter table termin_antworten
  add constraint termin_antworten_vorkommen_key
    unique (termin_id, vorkommen_datum, mitglied_id);
