-- Veranstalter-Akquise: Basis-Schema
-- RLS wird bewusst noch nicht aktiviert (Single-User-MVP). Sobald ein
-- Login-Flow kommt, hier Policies auf Basis von auth.uid() = user_id ergänzen.

create extension if not exists "pgcrypto";

-- Bands
create table bands (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- "90er Coverband" / "Backseat Alley"
  genre text,
  gagenrahmen_min integer,
  gagenrahmen_max integer,
  kontakt_email text,
  epk_link text,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id)
);

-- Veranstalter
create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  typ text check (typ in ('Festival', 'Stadtfest', 'Club', 'Firmenevent', 'Hochzeit', 'Sonstiges')),
  ort text,
  region text,
  website text,
  ansprechpartner text,
  email text,
  telefon text,
  quelle text, -- woher kam der Kontakt
  notizen text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  user_id uuid references auth.users(id)
);

-- Verknüpfung Band <-> Veranstalter (n:m, da ein Veranstalter für beide Bands infrage kommen kann)
create table venue_band_status (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) on delete cascade,
  band_id uuid references bands(id) on delete cascade,
  status text not null default 'neu' check (
    status in (
      'neu', 'recherchiert', 'kontaktiert', 'nachgefasst',
      'interessiert', 'abgesagt', 'gebucht'
    )
  ),
  letzter_kontakt_am timestamptz,
  naechster_follow_up_am timestamptz,
  unique(venue_id, band_id)
);

create index venues_name_idx on venues (name);
create index venues_typ_idx on venues (typ);
create index venues_region_idx on venues (region);
create index venue_band_status_venue_id_idx on venue_band_status (venue_id);
create index venue_band_status_band_id_idx on venue_band_status (band_id);
create index venue_band_status_status_idx on venue_band_status (status);
create index venue_band_status_follow_up_idx on venue_band_status (naechster_follow_up_am);
