-- Songs zum Proben: Welche Katalog-Songs bei einer konkreten Probe geübt
-- werden sollen. Hängt wie termin_antworten am einzelnen Vorkommen
-- (termin_id + vorkommen_datum), damit bei wiederholenden Proben jede Woche
-- ihre eigene Liste hat. Songs sind nur Referenzen auf band_songs -
-- Katalog-Änderungen (✎) wirken auch hier, gelöschte Songs verschwinden
-- per Cascade automatisch aus den Probenlisten.
--
-- Beim Ändern wird serverseitig die komplette Liste eines Vorkommens ersetzt
-- (wie bei setlist_eintraege) - einfacher als Einzel-Updates, bei den zu
-- erwartenden Größen (eine Handvoll Songs pro Probe) unbedenklich.
--
-- Zugriffsmodell wie seit 0016: RLS aktiv, KEINE anon/authenticated-Policies.
-- Zugriff ausschließlich serverseitig über den service_role-Client.
create table termin_songs (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references kalender_termine(id) on delete cascade,
  vorkommen_datum date not null,
  song_id uuid not null references band_songs(id) on delete cascade,
  position integer not null
);

create index termin_songs_vorkommen_idx on termin_songs (termin_id, vorkommen_datum);

alter table termin_songs enable row level security;
