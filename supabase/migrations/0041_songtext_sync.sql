-- Zeitsynchrone Fassung des Songtexts (LRC-Format: "[mm:ss.xx]Zeile").
--
-- Damit kann der Text auf der Bühne mitlaufen: Die Band tippt beim Einsatz auf
-- Start, ab da wird die jeweils aktuelle Zeile hervorgehoben. Eine echte
-- Wiedergabe gibt es hier nicht - die Zeit läuft ab dem Antippen.
--
-- Getrennt von songtext gespeichert, weil längst nicht jeder Song eine
-- synchrone Fassung hat (bei Trash Back 16 von 21) und der reine Text auch
-- ohne sie funktionieren muss.
alter table band_songs
  add column songtext_sync text;
