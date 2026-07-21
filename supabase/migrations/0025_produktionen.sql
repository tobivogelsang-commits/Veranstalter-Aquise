-- Produktions-Einträge pro Band (Studio-/Aufnahme-Fortschritt). name und datum
-- sind bewusst freie Textfelder (kein Datentyp date), da sie grob/unvollständig
-- gepflegt werden ("nächste Woche", "Demo v2"). step ist eine Einfachauswahl
-- (ein Prozessschritt), recordings eine Mehrfachauswahl (welche Spuren) - beide
-- als Text/Text-Array gespeichert und in der App gegen die erlaubten Werte
-- (PRODUKTION_STEPS / PRODUKTION_RECORDINGS in constants.ts) geprüft.
create table produktionen (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  name text not null default '',
  datum text not null default '',
  step text,
  recordings text[] not null default '{}',
  erstellt_am timestamptz not null default now()
);

create index produktionen_band_id_idx on produktionen (band_id);

alter table produktionen enable row level security;

-- Wie bei Songs/Setlisten bewusst offen: Zugriff erfolgt serverseitig über den
-- service_role-Client, Schutz ist der Login-Proxy (Inhaber) bzw. die nicht
-- erratbare Band-UUID (Team-App).
create policy "produktionen_alle_zugriffe" on produktionen
  for all to anon, authenticated
  using (true) with check (true);
