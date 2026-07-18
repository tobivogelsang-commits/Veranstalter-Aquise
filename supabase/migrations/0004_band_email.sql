-- E-Mail-Versand/-Empfang pro Band (eigenes Postfach je Band, z. B.
-- booking@90er-coverband.de). Zwei getrennte Tabellen:
--
-- band_email_konten: SMTP/IMAP-Zugangsdaten inkl. Passwort. Bewusst OHNE
-- RLS-Policy für anon/authenticated - nur der service_role-Key (serverseitig,
-- umgeht RLS) darf darauf zugreifen. So bleibt das Passwort vor dem
-- öffentlichen anon-Key geschützt, mit dem der Rest der App arbeitet.
-- Hinweis: Passwort liegt im Klartext in der DB (keine App-Verschlüsselung),
-- Schutz erfolgt ausschließlich über diese RLS-Sperre + serverseitigen Zugriff.
--
-- band_emails: Verlauf gesendeter/empfangener Mails (keine Zugangsdaten,
-- daher wie gewohnt offen für anon/authenticated).

create table band_email_konten (
  id uuid primary key default gen_random_uuid(),
  band_id uuid unique references bands(id) on delete cascade,
  absender_name text,
  email_adresse text,
  passwort text,
  smtp_host text,
  smtp_port integer,
  smtp_ssl boolean default true,
  imap_host text,
  imap_port integer,
  imap_ssl boolean default true,
  aktualisiert_am timestamptz default now()
);

alter table band_email_konten enable row level security;
-- Bewusst keine Policy hier -> RLS blockiert anon/authenticated komplett,
-- nur service_role kommt durch.

create table band_emails (
  id uuid primary key default gen_random_uuid(),
  band_id uuid references bands(id) on delete cascade,
  richtung text not null check (richtung in ('gesendet', 'empfangen')),
  von text,
  an text,
  betreff text,
  text_inhalt text,
  imap_uid text,
  zeitpunkt timestamptz default now()
);

create index band_emails_band_id_idx on band_emails (band_id);

alter table band_emails enable row level security;

create policy "band_emails_alle_zugriffe" on band_emails
  for all to anon, authenticated
  using (true) with check (true);
