// Anzeige-Labels der Beleg-Kategorien - ohne "server-only", damit Desktop-
// und Team-App-Komponenten sie gleichermaßen nutzen können.
import type { BelegKategorie } from "@/lib/database.types";

export const BELEG_KATEGORIE_LABELS: Record<BelegKategorie, string> = {
  fahrt: "Fahrtkosten",
  technik: "Technik",
  proberaum: "Proberaum",
  merch_einkauf: "Merch-Einkauf",
  gema: "GEMA",
  verpflegung: "Verpflegung",
  sonstiges: "Sonstiges",
};
