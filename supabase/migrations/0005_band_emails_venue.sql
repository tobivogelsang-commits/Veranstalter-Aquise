alter table band_emails add column venue_id uuid references venues(id) on delete set null;

create index band_emails_venue_id_idx on band_emails (venue_id);
