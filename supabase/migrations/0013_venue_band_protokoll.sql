-- Protokoll/Log pro Veranstalter UND Band (komplett getrennt, wie Dokumente/
-- Mails). "typ" ist ein fester Code (siehe VenueProtokoll.tsx für die Labels):
-- manuell "notiz" | "anruf" | "instagram" | "facebook" | "tiktok" | "kontakt",
-- automatisch "email_gesendet" | "email_beantwortet".
create table venue_band_protokoll (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  band_id uuid not null references bands(id) on delete cascade,
  typ text not null,
  text text,
  erstellt_am timestamptz not null default now()
);

create index venue_band_protokoll_venue_id_idx on venue_band_protokoll (venue_id);

alter table venue_band_protokoll enable row level security;

create policy "venue_band_protokoll_alle_zugriffe" on venue_band_protokoll
  for all to anon, authenticated
  using (true) with check (true);
