-- Urlaube der Band-Mitglieder: von jedem Mitglied selbst in der Team-App
-- eintragbar (bzw. vom Organizer am Desktop für alle). Angezeigt in beiden
-- Kalendern; beim Buchen eines Gigs, dessen Veranstaltungsdatum in einen
-- Urlaub fällt, warnt die App ("X ist im Urlaub") - übersteuerbar, keine
-- harte Sperre.
--
-- Zugriffsmodell wie seit 0016: RLS aktiv, KEINE anon/authenticated-Policies.
-- Zugriff ausschließlich serverseitig über den service_role-Client.
create table mitglied_urlaube (
  id uuid primary key default gen_random_uuid(),
  mitglied_id uuid not null references band_mitglieder(id) on delete cascade,
  von date not null,
  bis date not null,
  erstellt_am timestamptz default now(),
  check (bis >= von)
);

create index mitglied_urlaube_mitglied_id_idx on mitglied_urlaube (mitglied_id);

alter table mitglied_urlaube enable row level security;
