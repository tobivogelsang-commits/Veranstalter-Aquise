import type { PipelineEntry } from "@/lib/types";

// venue.veranstaltungsdatum kommt aus Postgres bereits als "yyyy-MM-dd"
// (Postgres date-Spalte) - hier direkt als Schlüssel nutzen statt über
// new Date(string) zu parsen und wieder zu formatieren (das würde über UTC
// laufen und je nach Zeitzone einen Tag verschieben, siehe src/lib/datum.ts).
export function gruppiereEintraegeProTag(
  eintraege: PipelineEntry[]
): Map<string, PipelineEntry[]> {
  const map = new Map<string, PipelineEntry[]>();
  for (const eintrag of eintraege) {
    const datum = eintrag.venue.veranstaltungsdatum;
    if (!datum) continue;
    const liste = map.get(datum) ?? [];
    liste.push(eintrag);
    map.set(datum, liste);
  }
  return map;
}

export type KalenderStatus = "gebucht" | "interessiert";

type BandFarben = {
  // Volle Pille für die Monatsansicht (viel Platz, Text lesbar).
  pill: Record<KalenderStatus, string>;
  // Kleiner Punkt für die Jahresansicht (mehrere Bands am selben Tag
  // brauchen dort je einen eigenen Punkt statt einer einzigen Zellfarbe).
  punkt: Record<KalenderStatus, string>;
};

// Feste Farbzuordnung pro Band, damit auf einen Blick erkennbar ist, welcher
// Gig zu welcher Band gehört - "gebucht" kräftig, "interessiert" deutlich
// heller/schwächer in derselben Farbfamilie. Unbekannte Bandnamen (z. B.
// falls später eine dritte Band dazukommt) fallen auf neutrales Grau zurück,
// statt zu crashen.
const BAND_FARBEN: Record<string, BandFarben> = {
  "90er Coverband": {
    pill: {
      gebucht: "bg-green-600 text-white hover:bg-green-700",
      interessiert:
        "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
    },
    punkt: {
      gebucht: "bg-green-600",
      interessiert: "bg-green-300",
    },
  },
  "Backseat Alley": {
    pill: {
      gebucht: "bg-red-600 text-white hover:bg-red-700",
      interessiert:
        "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
    },
    punkt: {
      gebucht: "bg-red-600",
      interessiert: "bg-orange-400",
    },
  },
};

const STANDARD_FARBEN: BandFarben = {
  pill: {
    gebucht: "bg-slate-700 text-white hover:bg-slate-800",
    interessiert: "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
  },
  punkt: {
    gebucht: "bg-slate-700",
    interessiert: "bg-slate-300",
  },
};

export function kalenderPillFarbe(bandName: string, status: KalenderStatus): string {
  return (BAND_FARBEN[bandName] ?? STANDARD_FARBEN).pill[status];
}

export function kalenderPunktFarbe(bandName: string, status: KalenderStatus): string {
  return (BAND_FARBEN[bandName] ?? STANDARD_FARBEN).punkt[status];
}

export function bekannteKalenderBands(): string[] {
  return Object.keys(BAND_FARBEN);
}
