-- Optionale Startzeit für selbst angelegte Termine.
--
-- Ergänzt 0018/0019: Ein Termin kann eine Uhrzeit haben (z. B. Probe 19:00).
-- Bewusst nur eine Startzeit (keine Endzeit) und optional - manche Einträge
-- (mehrtägige Events) haben keine sinnvolle einzelne Uhrzeit.
--
-- Gefahrlos: nur eine zusätzliche, nullbare Spalte.

alter table kalender_termine
  add column uhrzeit time;
