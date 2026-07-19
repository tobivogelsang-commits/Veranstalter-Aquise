-- Erweiterbare Liste möglicher Dokumente pro Band (Stage Rider, Angebot,
-- Pressetext etc.) - "Einstellungen" für diese Band, wie Vorlagen/
-- Mail-Zugangsdaten: einmal gepflegt, überall (jeder Veranstalter dieser
-- Band) automatisch verfügbar.
create table band_dokument_typen (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  name text not null,
  erstellt_am timestamptz not null default now(),
  unique(band_id, name)
);

create index band_dokument_typen_band_id_idx on band_dokument_typen (band_id);

-- Ob/wann ein bestimmtes Dokument an einen bestimmten Veranstalter (für eine
-- bestimmte Band) verschickt wurde. Kein Eintrag = noch nicht verschickt.
create table venue_band_dokumente (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  band_id uuid not null references bands(id) on delete cascade,
  dokument_typ_id uuid not null references band_dokument_typen(id) on delete cascade,
  versendet_am timestamptz,
  unique(venue_id, band_id, dokument_typ_id)
);

create index venue_band_dokumente_venue_id_idx on venue_band_dokumente (venue_id);

alter table band_dokument_typen enable row level security;
alter table venue_band_dokumente enable row level security;

create policy "band_dokument_typen_alle_zugriffe" on band_dokument_typen
  for all to anon, authenticated
  using (true) with check (true);

create policy "venue_band_dokumente_alle_zugriffe" on venue_band_dokumente
  for all to anon, authenticated
  using (true) with check (true);

-- Standard-Dokumente für alle bestehenden Bands vorbelegen.
insert into band_dokument_typen (band_id, name)
select b.id, t.name
from bands b
cross join (values ('Stage Rider'), ('Angebot'), ('Pressetext')) as t(name);
