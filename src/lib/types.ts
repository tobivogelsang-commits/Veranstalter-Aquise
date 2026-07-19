import type { Database } from "@/lib/database.types";

export type Band = Database["public"]["Tables"]["bands"]["Row"];
export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type VenueBandStatus =
  Database["public"]["Tables"]["venue_band_status"]["Row"];
export type BandMaterial = Database["public"]["Tables"]["band_materialien"]["Row"];
export type BandEmailKonto =
  Database["public"]["Tables"]["band_email_konten"]["Row"];
export type BandEmail = Database["public"]["Tables"]["band_emails"]["Row"];
export type EmailVorlage = Database["public"]["Tables"]["email_vorlagen"]["Row"];
export type BandMitglied = Database["public"]["Tables"]["band_mitglieder"]["Row"];
export type GigAnfrage = Database["public"]["Tables"]["gig_anfragen"]["Row"];
export type GigAntwortRow = Database["public"]["Tables"]["gig_antworten"]["Row"];

export type BandWithMaterialien = Band & {
  band_materialien: BandMaterial[];
};

// Einstellungen ohne das Passwort im Klartext - so wird der Client bedient,
// damit das Passwort nie zurück an den Browser geht (nur "ist gesetzt" ja/nein).
export type EmailEinstellungenOhnePasswort = Omit<BandEmailKonto, "passwort"> & {
  passwortGesetzt: boolean;
};

// Für die Verlaufsliste auf der Band-Seite: welcher Veranstalter (falls
// zugeordnet) gehört zu dieser E-Mail.
export type BandEmailMitVenue = BandEmail & {
  venue: Pick<Venue, "id" | "name"> | null;
};

// Für den E-Mail-Verlauf auf der Veranstalter-Seite: über welche Band wurde
// diese E-Mail gesendet/empfangen.
export type VenueEmailMitBand = BandEmail & {
  band: Pick<Band, "id" | "name">;
};

// Für das Veranstalter-Dropdown im Compose-Formular einer Band - inkl. der
// Felder, die als E-Mail-Vorlagen-Platzhalter ({{ort}}, {{ansprechpartner}})
// nutzbar sind.
export type BandVenueOption = Pick<
  Venue,
  "id" | "name" | "email" | "ort" | "ansprechpartner"
>;

// Ein Venue inkl. aller Band-Zuordnungen (0, 1 oder 2 Bands), so wie er aus
// der Supabase-Embed-Query kommt.
export type VenueWithRelations = Venue & {
  venue_band_status: (VenueBandStatus & { band: Band })[];
};

// Ein Eintrag der Pipeline: eine konkrete Band<->Venue-Beziehung, angereichert
// um die zugehörigen Venue- und Band-Daten. Wird für /venues und /pipeline
// nach clientseitiger Filterung erzeugt.
export type PipelineEntry = {
  venue: Venue;
  band: Band;
  relation: VenueBandStatus;
};

// Mitglied ohne Push-Zugangsdaten - so wird der Client bedient (z. B. für die
// Anzeige "wer hat abgesagt"), die Subscription-Details bleiben serverseitig.
export type BandMitgliedOhnePush = Omit<
  BandMitglied,
  "push_endpoint" | "push_p256dh" | "push_auth"
>;

// Anfrage inkl. aller bisherigen Antworten (mit Mitgliedsname) - für die
// Status-Anzeige auf Dashboard/Venue-Seite.
export type GigAnfrageMitAntworten = GigAnfrage & {
  antworten: (GigAntwortRow & { mitglied: BandMitgliedOhnePush })[];
};

// Für die Team-App: offene Anfrage inkl. der zugehörigen Veranstalter-Infos.
export type OffeneAnfrageFuerMitglied = GigAnfrage & {
  venue: Pick<Venue, "id" | "name" | "veranstaltungsdatum" | "ort">;
};
