alter table venue_band_status drop constraint venue_band_status_status_check;

alter table venue_band_status add constraint venue_band_status_status_check
  check (status in (
    'neu', 'recherchiert', 'kontaktiert', 'nachgefasst',
    'interessiert', 'bereit_zu_buchen', 'abgesagt', 'gebucht'
  ));
