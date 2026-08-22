// Katalog der freigebbaren Bereiche - bewusst OHNE "server-only", damit auch
// Client-Komponenten (Freigabe-Matrix, Navigation) die Liste und die Labels
// kennen. Die Durchsetzung passiert ausschließlich serverseitig (authServer).

export const FREIGABE_BEREICHE = [
  "akquise",
  "emails_lesen",
  "emails_senden",
  "angebote_ansehen",
  "angebote_bearbeiten",
  "kalender",
  "setlisten",
  "merch",
  "produktion",
] as const;

export type FreigabeBereich = (typeof FREIGABE_BEREICHE)[number];

export const BEREICH_LABELS: Record<FreigabeBereich, string> = {
  akquise: "Akquise",
  emails_lesen: "E-Mails lesen",
  emails_senden: "E-Mails senden",
  angebote_ansehen: "Angebote ansehen",
  angebote_bearbeiten: "Angebote bearbeiten",
  kalender: "Kalender",
  setlisten: "Setlisten",
  merch: "Merch",
  produktion: "Produktion",
};
