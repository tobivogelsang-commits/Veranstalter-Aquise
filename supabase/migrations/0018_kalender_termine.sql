-- Selbst angelegte Kalender-Termine mit Typ (Probe / Konzertmöglichkeit /
-- Event) plus Teilnahme-Antworten der Band-Mitglieder.
--
-- Bisher speiste sich der Kalender nur aus Band<->Veranstalter-Beziehungen
-- (Gigs) und dem externen, nur lesbaren Proberaum-Feed. Hier kommt eine dritte
-- Quelle dazu: frei anlegbare Termine, die der Organizer auf der Kalender-Seite
-- erfasst. Für jeden Termin können Mitglieder in der Team-App ihre eigene
-- Teilnahme zu- oder absagen - dieselbe Mechanik wie bei den Gig-Anfragen
-- (kann / kann_nicht), nur direkt am Termin statt über eine separate Anfrage.
--
-- Zugriffsmodell wie seit 0016: RLS aktiv, KEINE anon/authenticated-Policies.
-- Die App greift ausschließlich serverseitig über den service_role-Client zu
-- (Team-App über die nicht erratbare Band-UUID, Organizer über den Login).
--
-- Ausrollen: unkritisch, reine Erweiterung ohne Abhängigkeit - App-Code, der
-- diese Tabellen nutzt, kommt separat und verträgt fehlende Termine (leer).

create table kalender_termine (
  id uuid primary key default gen_random_uuid(),
  band_id uuid references bands(id) on delete cascade,
  typ text not null check (typ in ('probe', 'konzertmoeglichkeit', 'event')),
  titel text not null,
  datum date not null,
  -- Optionales Enddatum für mehrtägige Termine (inklusiv). Bei eintägigen
  -- Terminen leer.
  datum_bis date,
  ort text,
  notiz text,
  erstellt_am timestamptz default now()
);

create index kalender_termine_band_id_idx on kalender_termine (band_id);
create index kalender_termine_datum_idx on kalender_termine (datum);

alter table kalender_termine enable row level security;

create table termin_antworten (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid references kalender_termine(id) on delete cascade,
  mitglied_id uuid references band_mitglieder(id) on delete cascade,
  antwort text not null check (antwort in ('kann', 'kann_nicht')),
  beantwortet_am timestamptz default now(),
  unique (termin_id, mitglied_id)
);

create index termin_antworten_termin_id_idx on termin_antworten (termin_id);

alter table termin_antworten enable row level security;
