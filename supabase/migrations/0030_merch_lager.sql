-- Merch-Lager: Bestand an T-Shirts, CDs, Buttons, Stickern etc. plus die
-- zugehörigen Druck-/Design-Vorlagen.
--
-- Ein Artikel = eine Zeile mit eigenem Bestand. Größen (S/M/L/XL) laufen über
-- `variante`, weil Nachbestellungen pro Größe erfolgen - "T-Shirt" als ein
-- einziger Posten wäre für die Planung wertlos. `mindestbestand` ist die
-- Schwelle, ab der die App zum Nachbestellen auffordert.
--
-- Zugriffsmodell wie seit 0016: RLS aktiv, KEINE anon/authenticated-Policies.
-- Zugriff ausschließlich serverseitig über den service_role-Client (Team-App
-- über die nicht erratbare Band-UUID, Organizer über den Login).
create table merch_artikel (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  kategorie text not null default 'Sonstiges',
  name text not null,
  -- z. B. Größe "L" oder Farbe; leer bei Artikeln ohne Varianten (CD, Sticker).
  variante text not null default '',
  bestand integer not null default 0 check (bestand >= 0),
  mindestbestand integer not null default 0 check (mindestbestand >= 0),
  notiz text,
  erstellt_am timestamptz not null default now()
);

create index merch_artikel_band_id_idx on merch_artikel (band_id);

-- Design-/Druckvorlagen (T-Shirt-Motive, CD-Cover, Sticker-Dateien). Liegen im
-- privaten Anhang-Bucket; gespeichert wird nur der Pfad, Download-Links
-- entstehen beim Anzeigen als kurzlebige signierte URL (wie bei Dokumenten).
-- artikel_id optional: Vorlagen können einem Artikel zugeordnet sein oder
-- allgemein zur Band gehören.
create table merch_vorlagen (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  artikel_id uuid references merch_artikel(id) on delete set null,
  titel text not null default '',
  dateiname text not null,
  pfad text not null,
  ist_bild boolean not null default false,
  erstellt_am timestamptz not null default now()
);

create index merch_vorlagen_band_id_idx on merch_vorlagen (band_id);

alter table merch_artikel enable row level security;
alter table merch_vorlagen enable row level security;
