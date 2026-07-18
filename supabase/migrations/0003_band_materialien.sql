-- Freie Materialliste pro Band (Stage Rider, EPK, YouTube-Links, Fotos, ...).
-- Bewusst als Titel+Link-Liste statt fester Spalten, damit neue Materialarten
-- später ohne weitere Migration ergänzt werden können.

create table band_materialien (
  id uuid primary key default gen_random_uuid(),
  band_id uuid references bands(id) on delete cascade,
  titel text not null,
  url text not null,
  typ text,
  erstellt_am timestamptz default now()
);

create index band_materialien_band_id_idx on band_materialien (band_id);

alter table band_materialien enable row level security;

create policy "band_materialien_alle_zugriffe" on band_materialien
  for all to anon, authenticated
  using (true) with check (true);
