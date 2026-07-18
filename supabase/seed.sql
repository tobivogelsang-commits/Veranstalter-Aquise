-- Beispieldaten: je eine Band und ein Beispiel-Veranstalter pro Band.
-- Kann im Supabase SQL-Editor ausgeführt werden, nachdem 0001_init.sql gelaufen ist.

insert into bands (name, genre, gagenrahmen_min, gagenrahmen_max, kontakt_email, epk_link)
values
  ('90er Coverband', '90er Pop/Rock Coverband', 800, 1800, 'booking@90er-coverband.de', 'https://example.com/epk/90er-coverband'),
  ('Backseat Alley', 'Indie/Alternative Rock', 500, 1200, 'booking@backseat-alley.de', 'https://example.com/epk/backseat-alley');

with b as (
  select id, name from bands
),
v1 as (
  insert into venues (name, typ, ort, region, website, ansprechpartner, email, telefon, quelle, notizen)
  values (
    'Stadtfest Musterstadt',
    'Stadtfest',
    'Musterstadt',
    'Baden-Württemberg',
    'https://stadtfest-musterstadt.de',
    'Anna Beispiel',
    'kultur@musterstadt.de',
    '0711 1234567',
    'Website Stadtverwaltung',
    'Erstkontakt per Mail, Bühne vorhanden, Backline teilweise gestellt.'
  )
  returning id
),
v2 as (
  insert into venues (name, typ, ort, region, website, ansprechpartner, email, telefon, quelle, notizen)
  values (
    'Rockfabrik Musterhausen',
    'Club',
    'Musterhausen',
    'Bayern',
    'https://rockfabrik-musterhausen.de',
    'Tom Mustermann',
    'booking@rockfabrik-musterhausen.de',
    '089 7654321',
    'Empfehlung von befreundeter Band',
    'Sucht Support-Acts für Samstagabende, gute Anlage vor Ort.'
  )
  returning id
)
insert into venue_band_status (venue_id, band_id, status, letzter_kontakt_am, naechster_follow_up_am)
select v1.id, b.id, 'recherchiert', now(), now() + interval '5 days'
from v1, b where b.name = '90er Coverband'
union all
select v2.id, b.id, 'kontaktiert', now() - interval '2 days', now() + interval '3 days'
from v2, b where b.name = 'Backseat Alley';
