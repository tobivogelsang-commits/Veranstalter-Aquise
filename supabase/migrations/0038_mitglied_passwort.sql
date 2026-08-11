-- Anmeldung der Team-Mitglieder mit Name + Passwort.
--
-- Bisher war die Identität allein die Mitglieds-UUID im localStorage des
-- Geräts. Das hatte zwei Folgen: Auf einem zweiten Gerät musste man sich neu
-- eintragen (und war damit doppelt in der Liste), und ein Name konnte beliebig
-- oft vergeben werden. Genau so sind vier Karteileichen entstanden.
--
-- passwort_hash ist bewusst nullable: Die bereits eingetragenen Mitglieder
-- haben noch keins. Sie setzen es bei ihrer nächsten Anmeldung selbst - ein
-- erzwungenes Zurücksetzen für alle wäre unnötig unfreundlich.
alter table band_mitglieder
  add column passwort_hash text;

-- Ein Name pro Band nur einmal - unabhängig von Gross-/Kleinschreibung und
-- umschliessenden Leerzeichen ("cj", "CJ " und "CJ" sind dieselbe Person).
-- Die Anwendung prueft das ebenfalls und gibt eine verstaendliche Meldung;
-- dieser Index ist der Riegel darunter, falls zwei Anmeldungen exakt
-- gleichzeitig eintreffen.
create unique index band_mitglieder_name_je_band_idx
  on band_mitglieder (band_id, lower(btrim(name)));
