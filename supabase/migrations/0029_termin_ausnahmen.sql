-- Ausnahme-Daten für wiederkehrende Termine: An diesen Daten fällt das
-- jeweilige Vorkommen aus ("nur diesen Termin löschen" im Kalender), ohne
-- die Serie zu beenden. Die Kalender-Expansion überspringt diese Tage.
-- Einmalige Termine brauchen das nicht - sie werden komplett gelöscht.
alter table kalender_termine
  add column ausnahmen date[] not null default '{}';
