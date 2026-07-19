-- Song-Katalog pro Band - Interpret und Dauer sind optional, da sie erst
-- nach und nach gepflegt werden (z. B. Dauer erst nach der Probe bekannt).
create table band_songs (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  titel text not null,
  interpret text,
  dauer_sekunden integer,
  erstellt_am timestamptz not null default now()
);

create index band_songs_band_id_idx on band_songs (band_id);

-- Mehrere benannte Setlisten pro Band (z. B. "Standardset", "Akustik-Set").
create table setlisten (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  name text not null,
  erstellt_am timestamptz not null default now()
);

create index setlisten_band_id_idx on setlisten (band_id);

-- Geordnete Songs einer Setliste. Beim Umsortieren/Hinzufügen/Entfernen wird
-- serverseitig die komplette Liste für eine Setliste ersetzt statt einzelner
-- Positions-Updates - einfacher als Positions-Verschiebungen zu berechnen,
-- bei den zu erwartenden Setlisten-Größen (wenige Dutzend Songs) unbedenklich.
create table setlist_eintraege (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references setlisten(id) on delete cascade,
  song_id uuid not null references band_songs(id) on delete cascade,
  position integer not null
);

create index setlist_eintraege_setlist_id_idx on setlist_eintraege (setlist_id);

alter table band_songs enable row level security;
alter table setlisten enable row level security;
alter table setlist_eintraege enable row level security;

create policy "band_songs_alle_zugriffe" on band_songs
  for all to anon, authenticated
  using (true) with check (true);

create policy "setlisten_alle_zugriffe" on setlisten
  for all to anon, authenticated
  using (true) with check (true);

create policy "setlist_eintraege_alle_zugriffe" on setlist_eintraege
  for all to anon, authenticated
  using (true) with check (true);
