-- Neue Supabase-Projekte aktivieren RLS inzwischen automatisch auf allen
-- Tabellen, auch wenn die Migration es nicht explizit anfordert. Ohne
-- Policies blockiert das jeden Zugriff über den anon-Key (auch lesend).
--
-- Für das Single-User-MVP (kein Login) erlauben wir hier bewusst alles.
-- Sobald ein Login-Flow kommt: diese Policies durch
-- `using (auth.uid() = user_id)` etc. ersetzen.

alter table bands enable row level security;
alter table venues enable row level security;
alter table venue_band_status enable row level security;

create policy "bands_alle_zugriffe" on bands
  for all to anon, authenticated
  using (true) with check (true);

create policy "venues_alle_zugriffe" on venues
  for all to anon, authenticated
  using (true) with check (true);

create policy "venue_band_status_alle_zugriffe" on venue_band_status
  for all to anon, authenticated
  using (true) with check (true);
