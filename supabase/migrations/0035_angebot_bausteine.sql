-- Textbausteine für Angebote: wiederkehrende Formulierungen für Einleitung,
-- Zahlungsbedingungen und Nachbemerkung, damit sie nicht jedes Mal neu
-- getippt werden müssen.
--
-- `feld` bestimmt, an welcher Stelle im Angebot der Baustein angeboten wird.
-- `ist_standard` markiert je Feld höchstens einen Baustein, der bei einem
-- neuen Angebot automatisch eingesetzt wird (mehrere sind technisch möglich,
-- die App nimmt dann den zuletzt angelegten - unkritisch).
create table angebot_bausteine (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  feld text not null check (feld in ('einleitung', 'zahlungsbedingungen', 'nachbemerkung')),
  titel text not null default '',
  text text not null default '',
  ist_standard boolean not null default false,
  erstellt_am timestamptz not null default now()
);

create index angebot_bausteine_band_id_idx on angebot_bausteine (band_id);

alter table angebot_bausteine enable row level security;
