import type {
  ProduktionRecording,
  ProduktionStep,
  Status,
  TerminTyp,
  TerminWiederholung,
  VenueTyp,
} from "@/lib/database.types";

export const STATUS_ORDER: Status[] = [
  "neu",
  "recherchiert",
  "kontaktiert",
  "nachgefasst",
  "interessiert",
  "abgesagt",
  "bereit_zu_buchen",
  "gebucht",
];

export const STATUS_LABELS: Record<Status, string> = {
  neu: "Neu",
  recherchiert: "Recherchiert",
  kontaktiert: "Kontaktiert",
  nachgefasst: "Nachgefasst",
  interessiert: "Interessiert",
  bereit_zu_buchen: "Bereit zu buchen",
  abgesagt: "Abgesagt",
  gebucht: "Gebucht",
};

// Grün = gebucht, Rot = abgesagt, Gelb-Töne = in Bearbeitung, Grau/Blau = frühe
// Phase. "Bereit zu buchen" bekommt bewusst eine kräftige, satte Farbe statt
// der sonst blassen Pastelltöne - das ist die einzige Aufgabe im Ablauf, die
// noch manuell erledigt werden muss (Buchung bestätigen), und soll deshalb
// überall sofort ins Auge fallen.
export const STATUS_COLORS: Record<Status, string> = {
  neu: "bg-slate-100 text-slate-700 border-slate-300",
  recherchiert: "bg-sky-100 text-sky-700 border-sky-300",
  kontaktiert: "bg-amber-100 text-amber-800 border-amber-300",
  nachgefasst: "bg-orange-100 text-orange-800 border-orange-300",
  interessiert: "bg-purple-100 text-purple-800 border-purple-300",
  bereit_zu_buchen: "bg-emerald-600 text-white border-emerald-700",
  abgesagt: "bg-red-100 text-red-700 border-red-300",
  gebucht: "bg-green-100 text-green-800 border-green-300",
};

export const VENUE_TYPEN: VenueTyp[] = [
  "Festival",
  "Stadtfest",
  "Club",
  "Firmenevent",
  "Hochzeit",
  "Sonstiges",
];

// Festival/Stadtfest sind wiederkehrende, datierte Veranstaltungen (haben ein
// Veranstaltungsdatum). Club/Firmenevent/Hochzeit/Sonstiges sind feste
// Locations ohne inhärentes Datum - für sie darf nie automatisch ein Datum
// vorausgefüllt werden (auch nicht per Freitext-Heuristik aus einer
// Beschreibung), das muss dort immer manuell gesetzt werden.
export const EVENT_TYPEN = new Set<string>(["Festival", "Stadtfest"]);

export const ALLE_BANDS_PARAM = "alle";

// Vorschläge für die Materialliste einer Band - Freitext in der DB, damit
// später weitere Arten ergänzt werden können, ohne Migration.
export const BAND_MATERIAL_TYPEN = [
  "Instagram",
  "TikTok",
  "Facebook",
  "YouTube",
  "EPK",
];

// Prozessschritte (Einfachauswahl) und Aufnahme-Spuren (Mehrfachauswahl) für
// den Produktion-Tab. In der DB als Text/Text-Array gespeichert; diese Listen
// sind die erlaubten Werte und zugleich die Reihenfolge der Chips im UI.
export const PRODUKTION_STEPS: ProduktionStep[] = [
  "Jam",
  "Strukturiert",
  "Aufnahmen",
  "Mixen",
  "Mastern",
  "Bearbeiten",
  "Veröffentlichen",
];

export const PRODUKTION_RECORDINGS: ProduktionRecording[] = [
  "Vox",
  "Keys",
  "Gitarre",
  "Drums",
  "Sample",
];

// Rollen für Ansprechpartner vor Ort bei einem gebuchten Auftritt
// (venues.gig_ansprechpartner).
export const GIG_ANSPRECHPARTNER_ROLLEN = [
  "Techniker",
  "Veranstalter",
  "Crew",
  "Sonstiges",
] as const;

// Home-Bildschirm-Icon der Team-App pro Band (statische Datei unter
// public/team-icons/, keine Datenbank-Spalte) - fehlt ein Eintrag, greift in
// getTeamIconPfade() der Standard-favicon als Fallback. Provisorisch als
// Konstante gepflegt, bis ggf. ein Upload-UI dafür existiert.
export const TEAM_ICON_PFADE: Record<string, { klein: string; gross: string }> = {
  "a9a405e1-6ad8-4575-af0d-f0862f4e7ceb": {
    klein: "/team-icons/trash-back-192.jpg",
    gross: "/team-icons/trash-back-512.jpg",
  },
};

export function getTeamIconPfade(bandId: string): { klein: string; gross: string } | null {
  return TEAM_ICON_PFADE[bandId] ?? null;
}

// Selbst angelegte Kalender-Termine (siehe Migration 0018). Alle drei Typen
// sind von Team-Mitgliedern bestätigbar (Zu-/Absage der eigenen Teilnahme).
export const TERMIN_TYPEN: TerminTyp[] = ["probe", "konzertmoeglichkeit", "event"];

export const TERMIN_TYP_LABEL: Record<TerminTyp, string> = {
  probe: "Probe",
  konzertmoeglichkeit: "Konzertmöglichkeit",
  event: "Event",
};

export const TERMIN_WIEDERHOLUNGEN: TerminWiederholung[] = [
  "einmalig",
  "woechentlich",
  "zweiwoechentlich",
  "monatlich",
];

export const TERMIN_WIEDERHOLUNG_LABEL: Record<TerminWiederholung, string> = {
  einmalig: "Einmalig",
  woechentlich: "Wöchentlich",
  zweiwoechentlich: "Alle 2 Wochen",
  monatlich: "Monatlich",
};

// Farbklassen je Termin-Typ für die Kalenderdarstellung - bewusst andere
// Farbfamilien als die Band-Gig-Farben (grün/rot) und der Proberaum (grau),
// damit die drei Quellen auf einen Blick unterscheidbar bleiben.
export const TERMIN_TYP_FARBE: Record<TerminTyp, { pill: string; punkt: string }> = {
  probe: {
    pill: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
    punkt: "bg-indigo-500",
  },
  konzertmoeglichkeit: {
    pill: "bg-amber-100 text-amber-800 hover:bg-amber-200",
    punkt: "bg-amber-500",
  },
  event: {
    pill: "bg-sky-100 text-sky-800 hover:bg-sky-200",
    punkt: "bg-sky-500",
  },
};
