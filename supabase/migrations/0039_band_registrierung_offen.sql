-- Schalter je Band: Dürfen sich neue Mitglieder selbst eintragen?
--
-- Ohne diesen Schalter war das Entfernen eines Mitglieds wirkungslos: Der Name
-- wurde dadurch wieder frei, und wer den Band-Link kennt, konnte sich sofort
-- neu eintragen (zur Not unter anderem Namen). Das Passwort schützt nur ein
-- BESTEHENDES Konto vor Übernahme, nicht gegen Neuanlage.
--
-- Standard true, damit die Ersteinrichtung unverändert funktioniert und die
-- bestehenden Bands nicht plötzlich niemanden mehr aufnehmen. Ist die Band
-- vollzählig, schaltet der Inhaber in den Einstellungen zu - ab dann kommt
-- niemand Neues mehr hinein, wohl aber jedes bestehende Mitglied auf einem
-- weiteren Gerät.
alter table bands
  add column registrierung_offen boolean not null default true;
