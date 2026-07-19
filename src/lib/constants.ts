import type { Status, VenueTyp } from "@/lib/database.types";

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
