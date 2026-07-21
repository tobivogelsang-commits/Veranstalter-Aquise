-- Weitere Zeit zum gebuchten Auftritt (ergänzt 0021/0022):
--
-- gig_treffen_proberaum: Uhrzeit, zu der sich die Band am Proberaum trifft
-- (z. B. zum gemeinsamen Verladen/Losfahren) - steht in der Reihenfolge vor
-- Soundcheck/Einlass/Beginn/Ende.
--
-- Gefahrlos: nur eine zusätzliche, nullbare Spalte.

alter table venues
  add column gig_treffen_proberaum time;
