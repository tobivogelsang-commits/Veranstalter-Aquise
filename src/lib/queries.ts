// service_role-Client für ALLE Datenzugriffe (umgeht RLS). Seit dem
// RLS-Lockdown (Migration 0016) haben anon/authenticated keinen
// Tabellenzugriff mehr. Diese Reads laufen serverseitig; der Schutz erfolgt
// über den Login-Proxy (Inhaber-Bereich) bzw. die nicht erratbare Band-UUID
// (öffentliche Team-/Kalender-Routen). `supabase` und `supabaseAdmin` sind
// hier bewusst derselbe (privilegierte) Client.
import { supabaseAdmin, supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { signierteAnhangUrls } from "@/lib/storage";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import type { Database, Status, VenueTyp } from "@/lib/database.types";
import type {
  Band,
  BandDokumentTypMitUrl,
  BandEmailMitVenue,
  BandMaterial,
  BandSong,
  BandVenueOption,
  BandWithMaterialien,
  EmailVorlage,
  GigAnfrageMitAntworten,
  KalenderTermin,
  OffeneAnfrageFuerMitglied,
  PipelineEntry,
  Setliste,
  TerminAntwortMitName,
  TerminTeilnahme,
  Venue,
  VenueBandDokument,
  VenueBandProtokoll,
  VenueEmailMitBand,
  VenueWithRelations,
} from "@/lib/types";

export async function getBands(): Promise<Band[]> {
  const { data, error } = await supabase
    .from("bands")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Selbst angelegte Kalender-Termine (Probe/Konzertmöglichkeit/Event) für die
// Kalenderanzeige. Bei bandFilter === "alle" alle Bands, sonst nur die eine.
export async function getTermine(bandFilter: string): Promise<KalenderTermin[]> {
  let query = supabase.from("kalender_termine").select("*");
  if (bandFilter !== ALLE_BANDS_PARAM) query = query.eq("band_id", bandFilter);

  const { data, error } = await query.order("datum");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Teilnahme-Übersicht für Termine (B4): Roster pro Band (für "wer hat noch
// nicht geantwortet") plus alle Antworten je Vorkommen mit Mitgliedsname.
export async function getTerminTeilnahme(bandFilter: string): Promise<TerminTeilnahme> {
  let mitgliedQuery = supabase.from("band_mitglieder").select("id, name, band_id");
  if (bandFilter !== ALLE_BANDS_PARAM) mitgliedQuery = mitgliedQuery.eq("band_id", bandFilter);
  const { data: mitglieder, error: mFehler } = await mitgliedQuery.order("name");
  if (mFehler) throw new Error(mFehler.message);

  const mitgliederProBand: Record<string, { id: string; name: string }[]> = {};
  for (const m of mitglieder ?? []) {
    (mitgliederProBand[m.band_id] ??= []).push({ id: m.id, name: m.name });
  }

  // Antworten inkl. Band (zum Filtern) und Mitgliedsname (zum Anzeigen).
  let antwortQuery = supabase
    .from("termin_antworten")
    .select(
      "termin_id, vorkommen_datum, mitglied_id, antwort, kalender_termine!inner(band_id), band_mitglieder(name)"
    );
  if (bandFilter !== ALLE_BANDS_PARAM) {
    antwortQuery = antwortQuery.eq("kalender_termine.band_id", bandFilter);
  }
  const { data: antworten, error: aFehler } = await antwortQuery;
  if (aFehler) throw new Error(aFehler.message);

  const antwortenProVorkommen: Record<string, TerminAntwortMitName[]> = {};
  for (const a of (antworten ?? []) as unknown as {
    termin_id: string;
    vorkommen_datum: string;
    mitglied_id: string;
    antwort: "kann" | "kann_nicht";
    band_mitglieder: { name: string } | null;
  }[]) {
    const key = `${a.termin_id}__${a.vorkommen_datum}`;
    (antwortenProVorkommen[key] ??= []).push({
      mitgliedId: a.mitglied_id,
      name: a.band_mitglieder?.name ?? "?",
      antwort: a.antwort,
    });
  }

  return { mitgliederProBand, antwortenProVorkommen };
}

export async function getBandWithMaterialien(
  id: string
): Promise<BandWithMaterialien | null> {
  const { data, error } = await supabase
    .from("bands")
    .select("*, band_materialien(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as unknown as BandWithMaterialien | null;
}

// Anhänge liegen als Storage-Pfade im privaten Bucket. Fürs Anzeigen ergänzen
// wir pro Mail kurzlebige signierte Download-Links - in einem Sammelaufruf,
// nicht einzeln pro Anhang.
async function mitSigniertenAnhaengen<
  T extends { anhaenge: { dateiname: string; pfad: string }[] | null },
>(mails: T[]): Promise<T[]> {
  const pfade = mails.flatMap((m) => (m.anhaenge ?? []).map((a) => a.pfad));
  const urls = await signierteAnhangUrls(pfade);

  return mails.map((mail) => ({
    ...mail,
    anhaenge:
      mail.anhaenge?.map((a) => ({ ...a, url: urls[a.pfad] ?? "" })) ?? null,
  }));
}

export async function getBandEmails(
  bandId: string
): Promise<BandEmailMitVenue[]> {
  const { data, error } = await supabase
    .from("band_emails")
    .select("*, venue:venues(id, name)")
    .eq("band_id", bandId)
    .order("zeitpunkt", { ascending: false });

  if (error) throw new Error(error.message);
  return mitSigniertenAnhaengen((data ?? []) as unknown as BandEmailMitVenue[]);
}

// Veranstalter, die dieser Band zugeordnet sind - fürs Dropdown im
// Compose-Formular auf der Band-Seite.
export async function getVenuesForBand(
  bandId: string
): Promise<BandVenueOption[]> {
  const { data, error } = await supabase
    .from("venue_band_status")
    .select("venue:venues(id, name, email, ort, ansprechpartner)")
    .eq("band_id", bandId);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { venue: BandVenueOption }[])
    .map((r) => r.venue)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getEmailsForVenue(
  venueId: string
): Promise<VenueEmailMitBand[]> {
  const { data, error } = await supabase
    .from("band_emails")
    .select("*, band:bands(id, name)")
    .eq("venue_id", venueId)
    .order("zeitpunkt", { ascending: false });

  if (error) throw new Error(error.message);
  return mitSigniertenAnhaengen((data ?? []) as unknown as VenueEmailMitBand[]);
}

export async function getEmailVorlagen(bandId: string): Promise<EmailVorlage[]> {
  const { data, error } = await supabase
    .from("email_vorlagen")
    .select("*")
    .eq("band_id", bandId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Nur die Materialien-Liste (Titel + Link) einer Band - für die Schnell-
// Einfügen-Buttons im Mail-Compose-Bereich, ohne die ganze Band mitzuladen
// wie getBandWithMaterialien.
export async function getBandMaterialien(bandId: string): Promise<BandMaterial[]> {
  const { data, error } = await supabase
    .from("band_materialien")
    .select("*")
    .eq("band_id", bandId)
    .order("erstellt_am");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Liefert zusätzlich zum rohen Storage-Pfad (datei_pfad, zum Anhängen an eine
// Mail) einen frisch signierten Download-Link für die Anzeige.
export async function getBandDokumentTypen(
  bandId: string
): Promise<BandDokumentTypMitUrl[]> {
  const { data, error } = await supabase
    .from("band_dokument_typen")
    .select("*")
    .eq("band_id", bandId)
    .order("erstellt_am");

  if (error) throw new Error(error.message);

  const typen = data ?? [];
  const urls = await signierteAnhangUrls(
    typen.map((t) => t.datei_pfad).filter((p): p is string => Boolean(p))
  );

  return typen.map((typ) => ({
    ...typ,
    datei_url: typ.datei_pfad ? (urls[typ.datei_pfad] ?? null) : null,
  }));
}

// Alle Versendet-Einträge eines Veranstalters (über alle Bands hinweg) -
// clientseitig pro Band gefiltert, analog zu getEmailsForVenue.
export async function getVenueBandDokumente(
  venueId: string
): Promise<VenueBandDokument[]> {
  const { data, error } = await supabase
    .from("venue_band_dokumente")
    .select("*")
    .eq("venue_id", venueId);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Alle Protokoll-Einträge eines Veranstalters (über alle Bands hinweg,
// neueste zuerst) - clientseitig pro Band gefiltert, analog zu
// getVenueBandDokumente.
export async function getVenueBandProtokoll(
  venueId: string
): Promise<VenueBandProtokoll[]> {
  const { data, error } = await supabase
    .from("venue_band_protokoll")
    .select("*")
    .eq("venue_id", venueId)
    .order("erstellt_am", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type EingehendeEmailUebersicht = BandEmailMitVenue & {
  band: Pick<Band, "id" | "name">;
};

// Neueste eingegangene Antworten über alle (oder eine) Band(s) hinweg - fürs
// "Neue E-Mails"-Widget auf dem Dashboard, respektiert denselben Band-Filter
// wie der Rest der Seite.
export async function getNeuesteEingehendeEmails(
  bandFilter: string,
  limit: number
): Promise<EingehendeEmailUebersicht[]> {
  let query = supabase
    .from("band_emails")
    .select("*, venue:venues(id, name), band:bands(id, name)")
    .eq("richtung", "empfangen")
    .order("zeitpunkt", { ascending: false })
    .limit(limit);

  if (bandFilter !== ALLE_BANDS_PARAM) {
    query = query.eq("band_id", bandFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EingehendeEmailUebersicht[];
}

export type ProtokollUebersicht = VenueBandProtokoll & {
  venue: Pick<Venue, "id" | "name">;
  band: Pick<Band, "id" | "name">;
};

// Neueste Protokoll-Einträge über alle (oder eine) Band(s) hinweg - fürs
// Aktivitäts-Feed auf dem Dashboard.
export async function getNeuesteProtokollEintraege(
  bandFilter: string,
  limit: number
): Promise<ProtokollUebersicht[]> {
  let query = supabase
    .from("venue_band_protokoll")
    .select("*, venue:venues(id, name), band:bands(id, name)")
    .order("erstellt_am", { ascending: false })
    .limit(limit);

  if (bandFilter !== ALLE_BANDS_PARAM) {
    query = query.eq("band_id", bandFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProtokollUebersicht[];
}

export async function getBandSongs(bandId: string): Promise<BandSong[]> {
  const { data, error } = await supabase
    .from("band_songs")
    .select("*")
    .eq("band_id", bandId)
    .order("titel");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSetlisten(bandId: string): Promise<Setliste[]> {
  const { data, error } = await supabase
    .from("setlisten")
    .select("*")
    .eq("band_id", bandId)
    .order("erstellt_am");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Songs einer Setliste in der gespeicherten Reihenfolge.
export async function getSetlistSongs(setlistId: string): Promise<BandSong[]> {
  const { data, error } = await supabase
    .from("setlist_eintraege")
    .select("position, song:band_songs(*)")
    .eq("setlist_id", setlistId)
    .order("position");

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { position: number; song: BandSong }[]).map(
    (r) => r.song
  );
}

// Für die Druckansicht: eine einzelne Setliste inkl. Bandname, ohne die
// übrigen Setlisten der Band mitzuladen.
export async function getSetlisteMitBand(
  setlistId: string
): Promise<(Setliste & { band: Pick<Band, "id" | "name"> }) | null> {
  const { data, error } = await supabase
    .from("setlisten")
    .select("*, band:bands(id, name)")
    .eq("id", setlistId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as unknown as (Setliste & { band: Pick<Band, "id" | "name"> }) | null;
}

export type SetlisteMitSongs = Setliste & { songs: BandSong[] };

// Alle Setlisten einer Band inklusive ihrer Songs in Reihenfolge - für den
// Setliste-Builder und das GEMA-Einfügen im Mail-Compose-Bereich, die beide
// alle Setlisten gleichzeitig zur Hand haben müssen (Auswahl/Umschalten ohne
// weiteren Serverzugriff).
export async function getSetlistenMitSongs(bandId: string): Promise<SetlisteMitSongs[]> {
  const setlisten = await getSetlisten(bandId);
  const songsProSetliste = await Promise.all(
    setlisten.map((s) => getSetlistSongs(s.id))
  );
  return setlisten.map((s, i) => ({ ...s, songs: songsProSetliste[i] }));
}

export async function getVenuesWithRelations(): Promise<
  VenueWithRelations[]
> {
  const { data, error } = await supabase
    .from("venues")
    .select("*, venue_band_status(*, band:bands(*))")
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as VenueWithRelations[];
}

export async function getVenueWithRelations(
  id: string
): Promise<VenueWithRelations | null> {
  const { data, error } = await supabase
    .from("venues")
    .select("*, venue_band_status(*, band:bands(*))")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as unknown as VenueWithRelations | null;
}

// Flacht Venues + ihre Band-Zuordnungen zu einer Liste von
// Band<->Venue-Beziehungen ab und filtert nach den gewünschten Kriterien.
// Läuft in JS statt per SQL-Filter über die Embed-Relation, weil das bei der
// zu erwartenden Datenmenge (privates Akquise-Tool) einfacher und
// wartbarer ist als verschachtelte PostgREST-Filter.
export function toPipelineEntries(
  venues: VenueWithRelations[],
  bandId: string
): PipelineEntry[] {
  const entries: PipelineEntry[] = [];
  for (const venue of venues) {
    for (const relation of venue.venue_band_status) {
      if (bandId !== ALLE_BANDS_PARAM && relation.band_id !== bandId) continue;
      entries.push({ venue, band: relation.band, relation });
    }
  }
  return entries;
}

export type VenueFilter = {
  band: string;
  typ?: VenueTyp | "";
  region?: string;
  status?: Status | "";
  suche?: string;
};

export function filterVenues(
  venues: VenueWithRelations[],
  filter: VenueFilter
): VenueWithRelations[] {
  const suche = filter.suche?.trim().toLowerCase();

  return venues.filter((venue) => {
    if (filter.typ && venue.typ !== filter.typ) return false;
    if (filter.region && venue.region !== filter.region) return false;
    if (suche && !venue.name.toLowerCase().includes(suche)) return false;

    if (filter.band !== ALLE_BANDS_PARAM) {
      const relation = venue.venue_band_status.find(
        (r) => r.band_id === filter.band
      );
      if (!relation) return false;
      if (filter.status && relation.status !== filter.status) return false;
    } else if (filter.status) {
      const hatStatus = venue.venue_band_status.some(
        (r) => r.status === filter.status
      );
      if (!hatStatus) return false;
    }

    return true;
  });
}

export function getDistinctRegionen(venues: VenueWithRelations[]): string[] {
  const regionen = new Set<string>();
  for (const venue of venues) {
    if (venue.region) regionen.add(venue.region);
  }
  return Array.from(regionen).sort();
}

export type DashboardStats = {
  gesamtVeranstalter: number;
  proBand: { band: Band; anzahl: number }[];
  statusVerteilung: { status: Status; anzahl: number }[];
};

export function getDashboardStats(
  venues: VenueWithRelations[],
  bands: Band[],
  bandFilter: string
): DashboardStats {
  const proBand = bands.map((band) => ({
    band,
    anzahl: venues.filter((v) =>
      v.venue_band_status.some((r) => r.band_id === band.id)
    ).length,
  }));

  const relevanteRelationen = venues.flatMap((v) =>
    v.venue_band_status.filter(
      (r) => bandFilter === ALLE_BANDS_PARAM || r.band_id === bandFilter
    )
  );

  const statusVerteilung = Object.entries(
    relevanteRelationen.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([status, anzahl]) => ({ status: status as Status, anzahl }));

  return {
    gesamtVeranstalter: venues.length,
    proBand,
    statusVerteilung,
  };
}

// Follow-ups der nächsten 7 Tage plus überfällige (Datum in der
// Vergangenheit), sofern der Veranstalter noch nicht abschließend
// gebucht/abgesagt wurde.
export function getAnstehendeFollowUps(
  venues: VenueWithRelations[],
  bandFilter: string
): PipelineEntry[] {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const in7Tagen = new Date(heute);
  in7Tagen.setDate(in7Tagen.getDate() + 7);
  in7Tagen.setHours(23, 59, 59, 999);

  const entries = toPipelineEntries(venues, bandFilter);

  return entries
    .filter((entry) => {
      if (!entry.relation.naechster_follow_up_am) return false;
      if (entry.relation.status === "gebucht" || entry.relation.status === "abgesagt")
        return false;
      const datum = new Date(entry.relation.naechster_follow_up_am);
      return datum <= in7Tagen;
    })
    .sort(
      (a, b) =>
        new Date(a.relation.naechster_follow_up_am!).getTime() -
        new Date(b.relation.naechster_follow_up_am!).getTime()
    );
}

// Einträge für den Kalender: nur Band<->Venue-Beziehungen mit gesetztem
// Veranstaltungsdatum und Status "gebucht" oder "interessiert" (die einzigen
// Status mit echter Termin-Relevanz für die Kalenderansicht).
export function getKalenderEintraege(
  venues: VenueWithRelations[],
  bandFilter: string
): PipelineEntry[] {
  return toPipelineEntries(venues, bandFilter).filter(
    (entry) =>
      entry.venue.veranstaltungsdatum &&
      (entry.relation.status === "gebucht" || entry.relation.status === "interessiert")
  );
}

// Gig-Anfragen (Team-Verfügbarkeitsabfrage) zu den übergebenen Venues, inkl.
// aller bisherigen Antworten samt Mitgliedsname - für die Statusanzeige auf
// Dashboard/Venue-Seite ("3/4 bestätigt", "Absage von Tom" etc.). Läuft über
// den service_role-Client, da band_mitglieder keine anon-Policy hat.
export async function getGigAnfragenFuerVenues(
  venueIds: string[]
): Promise<GigAnfrageMitAntworten[]> {
  if (venueIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("gig_anfragen")
    .select(
      "*, antworten:gig_antworten(*, mitglied:band_mitglieder(id, band_id, name, erstellt_am))"
    )
    .in("venue_id", venueIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as GigAnfrageMitAntworten[];
}

// Offene (noch unbeantwortete) Anfragen für ein einzelnes Mitglied - für die
// Team-App. gig_anfragen/gig_antworten sind offen für anon, daher reicht hier
// der normale Client.
export async function getOffeneAnfragenFuerMitglied(
  mitgliedId: string,
  bandId: string
): Promise<OffeneAnfrageFuerMitglied[]> {
  const { data: beantwortet } = await supabase
    .from("gig_antworten")
    .select("anfrage_id")
    .eq("mitglied_id", mitgliedId);

  const beantworteteIds = new Set((beantwortet ?? []).map((a) => a.anfrage_id));

  const { data, error } = await supabase
    .from("gig_anfragen")
    .select("*, venue:venues(id, name, veranstaltungsdatum, ort)")
    .eq("band_id", bandId)
    .eq("status", "offen");

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as OffeneAnfrageFuerMitglied[]).filter(
    (anfrage) => !beantworteteIds.has(anfrage.id)
  );
}

// Anzahl Mitglieder je Band - für die "3/4 bestätigt"-Anzeige. Läuft über
// service_role, da band_mitglieder keine anon-Policy hat.
export async function getBandMitgliederAnzahlProBand(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from("band_mitglieder").select("band_id");
  if (error) throw new Error(error.message);

  const anzahl: Record<string, number> = {};
  for (const row of data ?? []) {
    anzahl[row.band_id] = (anzahl[row.band_id] ?? 0) + 1;
  }
  return anzahl;
}

export type { Database };
