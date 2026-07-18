create table band_mitglieder (
  id uuid primary key default gen_random_uuid(),
  band_id uuid references bands(id) on delete cascade,
  name text not null,
  push_endpoint text,
  push_p256dh text,
  push_auth text,
  erstellt_am timestamptz default now()
);

create index band_mitglieder_band_id_idx on band_mitglieder (band_id);

alter table band_mitglieder enable row level security;

create table gig_anfragen (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) on delete cascade,
  band_id uuid references bands(id) on delete cascade,
  status text not null default 'offen' check (status in ('offen', 'bestaetigt', 'abgesagt')),
  erstellt_am timestamptz default now(),
  abgeschlossen_am timestamptz
);

create index gig_anfragen_venue_id_idx on gig_anfragen (venue_id);
create index gig_anfragen_band_id_idx on gig_anfragen (band_id);
create index gig_anfragen_status_idx on gig_anfragen (status);

alter table gig_anfragen enable row level security;

create policy "gig_anfragen_alle_zugriffe" on gig_anfragen
  for all to anon, authenticated
  using (true) with check (true);

create table gig_antworten (
  id uuid primary key default gen_random_uuid(),
  anfrage_id uuid references gig_anfragen(id) on delete cascade,
  mitglied_id uuid references band_mitglieder(id) on delete cascade,
  antwort text not null check (antwort in ('kann', 'kann_nicht')),
  beantwortet_am timestamptz default now(),
  unique(anfrage_id, mitglied_id)
);

create index gig_antworten_anfrage_id_idx on gig_antworten (anfrage_id);

alter table gig_antworten enable row level security;

create policy "gig_antworten_alle_zugriffe" on gig_antworten
  for all to anon, authenticated
  using (true) with check (true);
