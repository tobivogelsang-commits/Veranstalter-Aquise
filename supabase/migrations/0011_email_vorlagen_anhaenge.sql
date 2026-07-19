create table email_vorlagen (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references bands(id) on delete cascade,
  name text not null,
  betreff text not null default '',
  inhalt text not null default '',
  created_at timestamptz not null default now()
);

create index email_vorlagen_band_id_idx on email_vorlagen (band_id);

-- Wie band_emails (offene Policy fürs Single-User-MVP ohne Login) - anders
-- als band_email_konten, das bewusst keine Policy hat, weil dort die
-- SMTP/IMAP-Passwörter liegen. email_vorlagen enthält keine Geheimnisse.
alter table email_vorlagen enable row level security;

create policy "email_vorlagen_alle_zugriffe" on email_vorlagen
  for all to anon, authenticated
  using (true) with check (true);

alter table band_emails add column anhaenge jsonb;

-- Bucket für per E-Mail versendete Bilder/Anhänge. Public, damit die
-- öffentliche URL direkt in HTML-Mails (<img src="...">) sowie als
-- nodemailer-Attachment-Pfad nutzbar ist, ohne Signatur/Auth pro Abruf.
insert into storage.buckets (id, name, public)
values ('email-anhaenge', 'email-anhaenge', true)
on conflict (id) do nothing;
