-- Individuelle Freigaben pro Desktop-Nutzer + einmalige Einladungs-/Reset-Links.
--
-- Bisher gab es im Desktop-Tool nur "eingeloggt ja/nein" (requireOwner). Damit
-- weitere Bandmitglieder Zugang bekommen koennen, ohne alles zu sehen, bekommt
-- jeder Nutzer einzelne Freigaben pro Bereich. Der Admin (Inhaber) wird ueber
-- app_metadata.rolle = "admin" gekennzeichnet - das kann nur ueber das
-- Supabase-Dashboard bzw. den service_role-Key gesetzt werden, nicht vom
-- Nutzer selbst, und ist damit nicht aus der App heraus manipulierbar.

-- Freigaben je Nutzer. Kein Eintrag bzw. alles false = Nutzer sieht nur die
-- "Warte auf Freigabe"-Seite (fail closed - auch ein theoretisch selbst
-- registrierter Account kann damit nichts anfangen).
create table nutzer_freigaben (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Anmeldename fuer den Username-Login der Mitglieder (der Admin meldet sich
  -- weiter per E-Mail an). Die interne Supabase-E-Mail bleibt unsichtbar.
  benutzername text not null,
  akquise boolean not null default false,
  emails_lesen boolean not null default false,
  emails_senden boolean not null default false,
  angebote_ansehen boolean not null default false,
  angebote_bearbeiten boolean not null default false,
  kalender boolean not null default false,
  setlisten boolean not null default false,
  merch boolean not null default false,
  produktion boolean not null default false,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

-- Ein Benutzername nur einmal - unabhaengig von Gross-/Kleinschreibung und
-- umschliessenden Leerzeichen (gleiches Muster wie band_mitglieder, 0038).
create unique index nutzer_freigaben_benutzername_idx
  on nutzer_freigaben (lower(btrim(benutzername)));

-- Einmalige Links: Einladung (Nutzer legt Benutzername + Passwort an) und
-- Passwort-Reset (Admin verschickt, Nutzer setzt neues Passwort). In der DB
-- liegt nur der SHA-256-Hash des Tokens - ein DB-Leak verraet keine gueltigen
-- Links. verbraucht_am gesetzt = Link ist tot.
create table einladungen (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  zweck text not null check (zweck in ('einladung', 'passwort_reset')),
  -- Nur bei zweck = 'passwort_reset': der Nutzer, dessen Passwort neu gesetzt
  -- werden darf. Bei Einladungen entsteht der Nutzer erst beim Einloesen.
  user_id uuid references auth.users (id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  laeuft_ab timestamptz not null,
  verbraucht_am timestamptz
);

-- RLS an, bewusst OHNE Policies: Zugriff ausschliesslich serverseitig ueber
-- den service_role-Client (gleiches Muster wie der Lockdown in 0016).
alter table nutzer_freigaben enable row level security;
alter table einladungen enable row level security;

-- Alle BESTEHENDEN Logins werden Admin - Stand heute ist das nur der Inhaber.
-- Neue Nutzer entstehen kuenftig ueber den Einladungsfluss und bekommen keine
-- Rolle, nur Freigaben.
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"rolle": "admin"}'::jsonb;
