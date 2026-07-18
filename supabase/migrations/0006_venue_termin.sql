alter table venues add column veranstaltungsdatum date;

create index venues_veranstaltungsdatum_idx on venues (veranstaltungsdatum);
