import type { Status, VenueTyp } from "@/lib/database.types";

export const STATUS_ORDER: Status[] = [
  "neu",
  "recherchiert",
  "kontaktiert",
  "nachgefasst",
  "interessiert",
  "abgesagt",
  "gebucht",
];

export const STATUS_LABELS: Record<Status, string> = {
  neu: "Neu",
  recherchiert: "Recherchiert",
  kontaktiert: "Kontaktiert",
  nachgefasst: "Nachgefasst",
  interessiert: "Interessiert",
  abgesagt: "Abgesagt",
  gebucht: "Gebucht",
};

// Grün = gebucht, Rot = abgesagt, Gelb-Töne = in Bearbeitung, Grau/Blau = frühe Phase.
export const STATUS_COLORS: Record<Status, string> = {
  neu: "bg-slate-100 text-slate-700 border-slate-300",
  recherchiert: "bg-sky-100 text-sky-700 border-sky-300",
  kontaktiert: "bg-amber-100 text-amber-800 border-amber-300",
  nachgefasst: "bg-orange-100 text-orange-800 border-orange-300",
  interessiert: "bg-purple-100 text-purple-800 border-purple-300",
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

export const ALLE_BANDS_PARAM = "alle";

// Vorschläge für die Materialliste einer Band - Freitext in der DB, damit
// später weitere Arten ergänzt werden können, ohne Migration.
export const BAND_MATERIAL_TYPEN = [
  "Stage Rider",
  "EPK",
  "YouTube",
  "Fotos",
  "Social Media",
  "Sonstiges",
];
