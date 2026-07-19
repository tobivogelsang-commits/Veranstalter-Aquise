-- Optional hinterlegte Datei je Dokumententyp (z. B. das Stage-Rider-PDF) -
-- lässt sich dann im Mail-Compose-Bereich mit einem Klick anhängen, statt bei
-- jeder Mail neu hochgeladen werden zu müssen.
alter table band_dokument_typen
  add column datei_url text,
  add column dateiname text;
