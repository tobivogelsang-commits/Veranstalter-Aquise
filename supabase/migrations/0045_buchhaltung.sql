-- Buchhaltung pro Band: Rechnungen, Belege, Gagenverteilung.
--
-- Rahmen: Beide Bands sind GbRs mit Kleinunternehmerregelung (§ 19 UStG,
-- ust_satz = 0). Der Steuerberater macht den Abschluss - die App sammelt
-- Rechnungen und Belege und liefert am Jahresende den Export.

-- 1) Rechnungen. Aufbau wie angebote (Empfaenger als KOPIE, positionen als
--    jsonb) plus Rechnungs-Spezifika. GoBD-Grundsatz: Eine versendete
--    Rechnung wird nie geaendert oder geloescht - Korrektur nur per
--    Storno-Rechnung (negative Betraege, storno_von zeigt aufs Original).
--    Die App erzwingt das in den Server-Actions; die DB haelt die Verweise.
create table rechnungen (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  venue_id uuid references venues(id) on delete set null,
  -- Aus welchem Angebot die Rechnung entstand (Schalter im Angebot).
  angebot_id uuid references angebote(id) on delete set null,
  -- Bei einer Storno-Rechnung: das stornierte Original.
  storno_von uuid references rechnungen(id) on delete set null,
  nummer text not null,
  datum date not null default current_date,
  -- Leistungsdatum (Pflichtangabe) = i. d. R. das Auftrittsdatum.
  leistungsdatum date,
  faellig_am date,
  bezahlt_am date,
  empfaenger_name text not null default '',
  empfaenger_ansprechpartner text,
  empfaenger_strasse text,
  empfaenger_plz text,
  empfaenger_ort text,
  titel text not null default 'Rechnung',
  einleitung text,
  positionen jsonb not null default '[]',
  ust_satz integer not null default 0,
  zahlungsbedingungen text,
  nachbemerkung text,
  status text not null default 'entwurf'
    check (status in ('entwurf', 'versendet', 'bezahlt', 'storniert')),
  pdf_pfad text,
  pdf_dateiname text,
  erstellt_am timestamptz not null default now(),
  -- Lueckenlos fortlaufende Nummern pro Band (RE-<Jahr>-<lfd>).
  unique (band_id, nummer)
);

create index rechnungen_band_id_idx on rechnungen (band_id);
create index rechnungen_venue_id_idx on rechnungen (venue_id);

-- 2) Belege (Ausgaben). Foto/PDF liegt im privaten Beleg-Bucket; Belege
--    werden nie geloescht (Aufbewahrungspflicht), nur korrigiert.
--    mitglied_id = wer privat vorgestreckt hat (null = Bandkasse/-konto);
--    erstattet_am haelt fest, wann die Auslage zurueckgezahlt wurde.
create table belege (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  datum date not null default current_date,
  betrag numeric(10, 2) not null default 0,
  haendler text,
  beschreibung text,
  kategorie text not null default 'sonstiges'
    check (kategorie in ('fahrt', 'technik', 'proberaum', 'merch_einkauf',
                         'gema', 'verpflegung', 'sonstiges')),
  mitglied_id uuid references band_mitglieder(id) on delete set null,
  -- Name als Kopie, damit die Auslage lesbar bleibt, falls das Mitglied
  -- spaeter entfernt wird.
  mitglied_name text,
  erstattet_am date,
  datei_pfad text,
  datei_typ text,
  erstellt_am timestamptz not null default now()
);

create index belege_band_id_idx on belege (band_id);
create index belege_datum_idx on belege (band_id, datum);

-- 3) Gagenverteilung: Anteile einer (bezahlten) Rechnung je Mitglied.
--    Vorbelegung: Gesamtbetrag gleichmaessig auf alle Mitglieder, in der
--    Oberflaeche anpassbar/abwaehlbar. Name als Kopie wie bei den Belegen.
create table gagen_anteile (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  rechnung_id uuid not null references rechnungen(id) on delete cascade,
  mitglied_id uuid references band_mitglieder(id) on delete set null,
  mitglied_name text not null,
  betrag numeric(10, 2) not null default 0,
  ausgezahlt_am date,
  erstellt_am timestamptz not null default now()
);

create index gagen_anteile_rechnung_idx on gagen_anteile (rechnung_id);
create index gagen_anteile_band_idx on gagen_anteile (band_id);

-- 4) Privater Bucket fuer Beleg-Dateien (Fotos/PDFs). Nicht public - Anzeige
--    laeuft ueber kurzlebige signierte URLs wie bei den Mail-Anhaengen.
insert into storage.buckets (id, name, public)
values ('belege', 'belege', false)
on conflict (id) do nothing;

-- 5) Neuer Freigabe-Bereich "Buchhaltung" (ansehen/bearbeiten getrennt,
--    wie bei den Angeboten).
alter table nutzer_freigaben
  add column buchhaltung_ansehen boolean not null default false,
  add column buchhaltung_bearbeiten boolean not null default false;

-- RLS an, ohne Policies: Zugriff nur serverseitig (Muster wie ueberall).
alter table rechnungen enable row level security;
alter table belege enable row level security;
alter table gagen_anteile enable row level security;
