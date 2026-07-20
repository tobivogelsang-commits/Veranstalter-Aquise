-- Login-Umstellung: Zugriffsschutz statt offener Policies.
--
-- Bisher (Single-User-MVP ohne Login) erlaubten die Policies aus
-- 0002/0003/... jedem anon/authenticated-Client Voll-Lese- und Schreibzugriff
-- (`using (true) with check (true)`). Da der anon-Key öffentlich ist, konnte
-- damit jede/r über die Supabase-REST-API direkt die komplette Datenbank lesen
-- und ändern - ganz ohne die App.
--
-- Neues Modell: Die App greift serverseitig ausschließlich über den
-- service_role-Client zu (umgeht RLS). Der Zugriffsschutz erfolgt über den
-- Next.js-Login-Proxy plus requireOwner() je Inhaber-Aktion; die öffentliche
-- Team-App läuft ebenfalls serverseitig über service_role, geschützt durch die
-- nicht erratbare Band-UUID. Deshalb werden hier die offenen anon/authenticated-
-- Policies entfernt. RLS bleibt auf allen Tabellen aktiv -> anon/authenticated
-- erhalten damit KEINEN direkten Tabellenzugriff mehr, nur noch service_role.
--
-- WICHTIG (Reihenfolge beim Ausrollen): Zuerst den neuen App-Code deployen
-- (nutzt service_role + Login), erst danach diese Migration anwenden. Der alte
-- Code (anon-Client) würde nach dem Drop keine Daten mehr lesen/schreiben.

drop policy if exists "bands_alle_zugriffe" on bands;
drop policy if exists "venues_alle_zugriffe" on venues;
drop policy if exists "venue_band_status_alle_zugriffe" on venue_band_status;
drop policy if exists "band_materialien_alle_zugriffe" on band_materialien;
drop policy if exists "band_emails_alle_zugriffe" on band_emails;
drop policy if exists "gig_anfragen_alle_zugriffe" on gig_anfragen;
drop policy if exists "gig_antworten_alle_zugriffe" on gig_antworten;
drop policy if exists "band_dokument_typen_alle_zugriffe" on band_dokument_typen;
drop policy if exists "venue_band_dokumente_alle_zugriffe" on venue_band_dokumente;
drop policy if exists "venue_band_protokoll_alle_zugriffe" on venue_band_protokoll;
drop policy if exists "email_vorlagen_alle_zugriffe" on email_vorlagen;
drop policy if exists "band_songs_alle_zugriffe" on band_songs;
drop policy if exists "setlisten_alle_zugriffe" on setlisten;
drop policy if exists "setlist_eintraege_alle_zugriffe" on setlist_eintraege;

-- Sicherstellen, dass RLS wirklich aktiv bleibt (falls eine Tabelle es aus
-- irgendeinem Grund nicht mehr hätte). Ohne aktive RLS + ohne Policy wäre der
-- Zugriff sonst wieder offen bzw. undefiniert.
alter table bands enable row level security;
alter table venues enable row level security;
alter table venue_band_status enable row level security;
alter table band_materialien enable row level security;
alter table band_emails enable row level security;
alter table gig_anfragen enable row level security;
alter table gig_antworten enable row level security;
alter table band_dokument_typen enable row level security;
alter table venue_band_dokumente enable row level security;
alter table venue_band_protokoll enable row level security;
alter table email_vorlagen enable row level security;
alter table band_songs enable row level security;
alter table setlisten enable row level security;
alter table setlist_eintraege enable row level security;
