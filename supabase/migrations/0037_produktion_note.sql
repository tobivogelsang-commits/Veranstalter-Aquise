-- Prioritäts-Note (Schulnoten 1-6) für Produktions-Einträge. Sie ist nicht nur
-- ein Etikett, sondern steuert die Sortierung der Liste: 1 steigt nach oben,
-- 6 rutscht nach unten und bekommt dadurch bewusst weniger Aufmerksamkeit.
--
-- Bewusst nullable und ohne Default: Ein frisch angelegter Eintrag ("+ Neuer
-- Eintrag") ist noch nicht bewertet, und ein Default würde jede neue Idee
-- stillschweigend als mittelmäßig einstufen. Unbenotete werden in der App ganz
-- oben einsortiert - sie brauchen ja gerade eine Einordnung.
--
-- Gefahrlos ausrollbar: bestehende Zeilen bekommen null.
alter table produktionen
  add column note smallint,
  add constraint produktionen_note_bereich
    check (note is null or note between 1 and 6);
