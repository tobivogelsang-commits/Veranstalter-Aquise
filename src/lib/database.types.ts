// Handgeschrieben passend zu supabase/migrations/0001_init.sql.
// Sobald das Supabase-Projekt läuft, kann diese Datei mit
// `npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts`
// automatisch aktualisiert werden.

export type Status =
  | "neu"
  | "recherchiert"
  | "kontaktiert"
  | "nachgefasst"
  | "interessiert"
  | "bereit_zu_buchen"
  | "abgesagt"
  | "gebucht";

export type VenueTyp =
  | "Festival"
  | "Stadtfest"
  | "Club"
  | "Firmenevent"
  | "Hochzeit"
  | "Sonstiges";

export type GigAnfrageStatus = "offen" | "bestaetigt" | "abgesagt";
export type GigAntwort = "kann" | "kann_nicht";

// Ein Ansprechpartner vor Ort bei einem gebuchten Auftritt (venues.gig_ansprechpartner, jsonb-Liste).
export type GigAnsprechpartner = {
  rolle: string;
  name: string;
  telefon: string;
};

// Eine Pause innerhalb einer Setliste (setlisten.pausen, jsonb-Liste): X Minuten
// nach dem Song mit 0-basiertem Index nach_index. Trennt die Setliste in "Sets".
export type SetlistPause = {
  nach_index: number;
  minuten: number;
};

export type TerminTyp = "probe" | "konzertmoeglichkeit" | "event";
export type TerminWiederholung =
  | "einmalig"
  | "woechentlich"
  | "zweiwoechentlich"
  | "monatlich";

// So in band_emails.anhaenge (jsonb) und beim Versand genutzt - url ist die
// öffentliche Supabase-Storage-URL, direkt als nodemailer-Attachment-Pfad
// und (bei Bildern) als <img src> in der HTML-Mail verwendbar.
// So wird ein Anhang gespeichert: als Storage-Pfad im privaten Bucket, NICHT
// als URL. Öffentliche URLs wären dauerhaft abrufbar; Download-Links entstehen
// erst beim Anzeigen als kurzlebige signierte URL (siehe EmailAnhangAnzeige).
export type EmailAnhang = {
  dateiname: string;
  pfad: string;
};

// Anzeige-Variante: um eine frisch signierte, zeitlich begrenzte URL ergänzt.
export type EmailAnhangAnzeige = EmailAnhang & {
  url: string;
};

export interface Database {
  public: {
    Tables: {
      bands: {
        Row: {
          id: string;
          name: string;
          genre: string | null;
          gagenrahmen_min: number | null;
          gagenrahmen_max: number | null;
          kontakt_email: string | null;
          epk_link: string | null;
          created_at: string;
          user_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["bands"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["bands"]["Row"]>;
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          name: string;
          typ: VenueTyp | null;
          ort: string | null;
          region: string | null;
          strasse: string | null;
          website: string | null;
          instagram: string | null;
          tiktok: string | null;
          facebook: string | null;
          ansprechpartner: string | null;
          email: string | null;
          telefon: string | null;
          quelle: string | null;
          notizen: string | null;
          veranstaltungsdatum: string | null;
          gig_einlass: string | null;
          gig_soundcheck: string | null;
          gig_beginn: string | null;
          gig_treffen_proberaum: string | null;
          gig_zeiten_notiz: string | null;
          gig_logistik: string | null;
          gig_kontakt_name: string | null;
          gig_kontakt_telefon: string | null;
          gig_ende: string | null;
          gig_ansprechpartner: GigAnsprechpartner[];
          gig_setliste_id: string | null;
          created_at: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["venues"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["venues"]["Row"]>;
        Relationships: [];
      };
      venue_band_status: {
        Row: {
          id: string;
          venue_id: string;
          band_id: string;
          status: Status;
          letzter_kontakt_am: string | null;
          naechster_follow_up_am: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["venue_band_status"]["Row"]
        > & {
          venue_id: string;
          band_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["venue_band_status"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "venue_band_status_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_band_status_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      band_materialien: {
        Row: {
          id: string;
          band_id: string;
          titel: string;
          url: string;
          typ: string | null;
          erstellt_am: string;
        };
        Insert: Partial<Database["public"]["Tables"]["band_materialien"]["Row"]> & {
          band_id: string;
          titel: string;
          url: string;
        };
        Update: Partial<Database["public"]["Tables"]["band_materialien"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "band_materialien_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      band_email_konten: {
        Row: {
          id: string;
          band_id: string;
          absender_name: string | null;
          email_adresse: string | null;
          passwort: string | null;
          smtp_host: string | null;
          smtp_port: number | null;
          smtp_ssl: boolean;
          imap_host: string | null;
          imap_port: number | null;
          imap_ssl: boolean;
          aktualisiert_am: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["band_email_konten"]["Row"]
        > & {
          band_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["band_email_konten"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "band_email_konten_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: true;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      band_emails: {
        Row: {
          id: string;
          band_id: string;
          venue_id: string | null;
          richtung: "gesendet" | "empfangen";
          von: string | null;
          an: string | null;
          betreff: string | null;
          text_inhalt: string | null;
          imap_uid: string | null;
          zeitpunkt: string;
          anhaenge: EmailAnhang[] | null;
        };
        Insert: Partial<Database["public"]["Tables"]["band_emails"]["Row"]> & {
          band_id: string;
          richtung: "gesendet" | "empfangen";
        };
        Update: Partial<Database["public"]["Tables"]["band_emails"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "band_emails_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "band_emails_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      email_vorlagen: {
        Row: {
          id: string;
          band_id: string;
          name: string;
          betreff: string;
          inhalt: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["email_vorlagen"]["Row"]> & {
          band_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_vorlagen"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "email_vorlagen_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      band_dokument_typen: {
        Row: {
          id: string;
          band_id: string;
          name: string;
          erstellt_am: string;
          datei_pfad: string | null;
          dateiname: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["band_dokument_typen"]["Row"]
        > & {
          band_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["band_dokument_typen"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "band_dokument_typen_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      venue_band_dokumente: {
        Row: {
          id: string;
          venue_id: string;
          band_id: string;
          dokument_typ_id: string;
          versendet_am: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["venue_band_dokumente"]["Row"]
        > & {
          venue_id: string;
          band_id: string;
          dokument_typ_id: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["venue_band_dokumente"]["Row"]
        >;
        Relationships: [
          {
            foreignKeyName: "venue_band_dokumente_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_band_dokumente_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_band_dokumente_dokument_typ_id_fkey";
            columns: ["dokument_typ_id"];
            isOneToOne: false;
            referencedRelation: "band_dokument_typen";
            referencedColumns: ["id"];
          },
        ];
      };
      venue_band_protokoll: {
        Row: {
          id: string;
          venue_id: string;
          band_id: string;
          typ: string;
          text: string | null;
          erstellt_am: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["venue_band_protokoll"]["Row"]
        > & {
          venue_id: string;
          band_id: string;
          typ: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["venue_band_protokoll"]["Row"]
        >;
        Relationships: [
          {
            foreignKeyName: "venue_band_protokoll_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_band_protokoll_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      band_mitglieder: {
        Row: {
          id: string;
          band_id: string;
          name: string;
          push_endpoint: string | null;
          push_p256dh: string | null;
          push_auth: string | null;
          erstellt_am: string;
        };
        Insert: Partial<Database["public"]["Tables"]["band_mitglieder"]["Row"]> & {
          band_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["band_mitglieder"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "band_mitglieder_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      gig_anfragen: {
        Row: {
          id: string;
          venue_id: string;
          band_id: string;
          status: GigAnfrageStatus;
          erstellt_am: string;
          abgeschlossen_am: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["gig_anfragen"]["Row"]> & {
          venue_id: string;
          band_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["gig_anfragen"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "gig_anfragen_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gig_anfragen_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      gig_antworten: {
        Row: {
          id: string;
          anfrage_id: string;
          mitglied_id: string;
          antwort: GigAntwort;
          beantwortet_am: string;
        };
        Insert: Partial<Database["public"]["Tables"]["gig_antworten"]["Row"]> & {
          anfrage_id: string;
          mitglied_id: string;
          antwort: GigAntwort;
        };
        Update: Partial<Database["public"]["Tables"]["gig_antworten"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "gig_antworten_anfrage_id_fkey";
            columns: ["anfrage_id"];
            isOneToOne: false;
            referencedRelation: "gig_anfragen";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gig_antworten_mitglied_id_fkey";
            columns: ["mitglied_id"];
            isOneToOne: false;
            referencedRelation: "band_mitglieder";
            referencedColumns: ["id"];
          },
        ];
      };
      band_songs: {
        Row: {
          id: string;
          band_id: string;
          titel: string;
          interpret: string | null;
          dauer_sekunden: number | null;
          erstellt_am: string;
        };
        Insert: Partial<Database["public"]["Tables"]["band_songs"]["Row"]> & {
          band_id: string;
          titel: string;
        };
        Update: Partial<Database["public"]["Tables"]["band_songs"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "band_songs_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      setlisten: {
        Row: {
          id: string;
          band_id: string;
          name: string;
          pausen: SetlistPause[];
          erstellt_am: string;
        };
        Insert: Partial<Database["public"]["Tables"]["setlisten"]["Row"]> & {
          band_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["setlisten"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "setlisten_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      setlist_eintraege: {
        Row: {
          id: string;
          setlist_id: string;
          song_id: string;
          position: number;
        };
        Insert: Partial<
          Database["public"]["Tables"]["setlist_eintraege"]["Row"]
        > & {
          setlist_id: string;
          song_id: string;
          position: number;
        };
        Update: Partial<Database["public"]["Tables"]["setlist_eintraege"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "setlist_eintraege_setlist_id_fkey";
            columns: ["setlist_id"];
            isOneToOne: false;
            referencedRelation: "setlisten";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "setlist_eintraege_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "band_songs";
            referencedColumns: ["id"];
          },
        ];
      };
      kalender_termine: {
        Row: {
          id: string;
          band_id: string;
          typ: TerminTyp;
          titel: string;
          datum: string;
          datum_bis: string | null;
          uhrzeit: string | null;
          ort: string | null;
          notiz: string | null;
          wiederholung: TerminWiederholung;
          wiederholung_bis: string | null;
          erstellt_am: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["kalender_termine"]["Row"]
        > & {
          band_id: string;
          typ: TerminTyp;
          titel: string;
          datum: string;
        };
        Update: Partial<Database["public"]["Tables"]["kalender_termine"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "kalender_termine_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      termin_antworten: {
        Row: {
          id: string;
          termin_id: string;
          mitglied_id: string;
          vorkommen_datum: string;
          antwort: GigAntwort;
          beantwortet_am: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["termin_antworten"]["Row"]
        > & {
          termin_id: string;
          mitglied_id: string;
          vorkommen_datum: string;
          antwort: GigAntwort;
        };
        Update: Partial<Database["public"]["Tables"]["termin_antworten"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "termin_antworten_termin_id_fkey";
            columns: ["termin_id"];
            isOneToOne: false;
            referencedRelation: "kalender_termine";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "termin_antworten_mitglied_id_fkey";
            columns: ["mitglied_id"];
            isOneToOne: false;
            referencedRelation: "band_mitglieder";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
