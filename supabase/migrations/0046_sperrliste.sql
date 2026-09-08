-- Sperrliste für Werbewidersprüche (DSGVO Art. 21 / UWG).
--
-- Wer "nicht mehr kontaktieren" sagt, darf bei der nächsten Google-Recherche
-- nicht wieder im Anschreib-Prozess landen. Der Widerspruch wird deshalb
-- DAUERHAFT festgehalten - nicht der Veranstalter gelöscht: Ohne Nachweis
-- könnte man den Widerspruch weder belegen noch künftig beachten. Genau dafür
-- ist eine Sperrliste auch datenschutzrechtlich zulässig.
--
-- Pro Band, nicht global: Ein Widerspruch gegenüber einer Band sperrt nur
-- diese. Die App zeigt beim Kontakt aber an, wenn eine ANDERE Band dort
-- abgewiesen wurde - so sieht man vor dem Anschreiben, woran man ist.
create table sperrliste (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  -- Bleibt bestehen, wenn der Veranstalter später gelöscht wird: Der
  -- Widerspruch gilt weiter, auch ohne den Datensatz dahinter.
  venue_id uuid references venues(id) on delete set null,
  -- Erkennungsmerkmale. E-Mail greift beim Mailversand, name+ort bei der
  -- Recherche - dort gibt es oft noch gar keine Adresse. Beide kleingeschrieben
  -- und ohne Rand-Leerzeichen ablegen, der Vergleich läuft direkt darüber.
  email text,
  name text,
  ort text,
  grund text,
  erstellt_am timestamptz not null default now(),
  -- Ein Eintrag ohne jedes Merkmal könnte niemanden schützen.
  constraint sperrliste_merkmal_noetig
    check (email is not null or name is not null)
);

create index sperrliste_band_idx on sperrliste (band_id);
create index sperrliste_email_idx on sperrliste (email);
create index sperrliste_name_idx on sperrliste (name);

-- Wie alle Tabellen seit Migration 0016: RLS an, KEINE Policy. Der Zugriff
-- läuft ausschließlich serverseitig über den service_role-Client.
alter table sperrliste enable row level security;
