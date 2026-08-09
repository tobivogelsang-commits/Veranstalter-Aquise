-- Angebote für Veranstalter (Etappe 1: Stammdaten + Angebot + PDF).
--
-- 1) Absender-/Briefkopfdaten pro Band: Anschrift, Kontakt und Bankverbindung
--    erscheinen im Briefkopf bzw. Fuß des Angebots. Bewusst pro Band (nicht
--    global), weil jede Band eigene Konto- und Kontaktdaten haben kann - wie
--    schon bei den E-Mail-Konten.
alter table bands
  add column absender_name text,
  add column absender_strasse text,
  add column absender_plz text,
  add column absender_ort text,
  add column absender_telefon text,
  add column bank_inhaber text,
  add column iban text,
  add column bic text,
  add column bank_name text,
  add column steuernummer text,
  add column ust_id text,
  -- Standard-Umsatzsteuersatz für neue Angebote: 0 = Kleinunternehmer nach
  -- § 19 UStG (dann erscheint der Pflichthinweis), sonst 7 oder 19.
  add column ust_satz integer not null default 0;

-- 2) Die Angebote selbst. Empfängerdaten werden beim Anlegen aus dem
--    Veranstalter KOPIERT statt verknüpft: Ein verschicktes Angebot darf sich
--    nicht nachträglich ändern, nur weil jemand die Veranstalter-Adresse
--    korrigiert. venue_id bleibt als Verweis erhalten (on delete set null).
--
--    positionen ist eine jsonb-Liste [{beschreibung, betrag}] - für
--    Band-Angebote reichen wenige Zeilen (Auftritt, Anfahrt, Technik), eine
--    eigene Tabelle wäre hier Overhead.
create table angebote (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  venue_id uuid references venues(id) on delete set null,
  nummer text not null,
  datum date not null default current_date,
  gueltig_bis date,
  empfaenger_name text not null default '',
  empfaenger_ansprechpartner text,
  empfaenger_strasse text,
  empfaenger_plz text,
  empfaenger_ort text,
  titel text not null default 'Angebot',
  einleitung text,
  positionen jsonb not null default '[]',
  ust_satz integer not null default 0,
  zahlungsbedingungen text,
  nachbemerkung text,
  status text not null default 'entwurf'
    check (status in ('entwurf', 'versendet', 'angenommen', 'abgelehnt')),
  -- Pfad des zuletzt erzeugten PDFs im privaten Anhang-Bucket; von dort wird
  -- es wie ein Dokument an die E-Mail gehängt.
  pdf_pfad text,
  pdf_dateiname text,
  erstellt_am timestamptz not null default now()
);

create index angebote_band_id_idx on angebote (band_id);
create index angebote_venue_id_idx on angebote (venue_id);

alter table angebote enable row level security;
