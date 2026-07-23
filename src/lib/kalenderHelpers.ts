import type {
  KalenderTermin,
  PipelineEntry,
  TeilnahmeStand,
  TerminTeilnahme,
  UrlaubMitName,
} from "@/lib/types";
import type { ProberaumTermin } from "@/lib/proberaumKalender";

// Teilnahme-Stand (dabei/abgesagt/offen + Gesamtzahl) für EIN Vorkommen aus
// der Übersicht ableiten. "offen" = Mitglieder der Band ohne Antwort.
export function berechneTeilnahme(
  teilnahme: TerminTeilnahme | undefined,
  terminId: string,
  vorkommenDatum: string,
  bandId: string
): TeilnahmeStand {
  const roster = teilnahme?.mitgliederProBand[bandId] ?? [];
  const antworten = teilnahme?.antwortenProVorkommen[`${terminId}__${vorkommenDatum}`] ?? [];
  const beantwortetIds = new Set(antworten.map((a) => a.mitgliedId));
  return {
    dabei: antworten.filter((a) => a.antwort === "kann").map((a) => a.name),
    abgesagt: antworten.filter((a) => a.antwort === "kann_nicht").map((a) => a.name),
    offen: roster.filter((m) => !beantwortetIds.has(m.id)).map((m) => m.name),
    gesamt: roster.length,
  };
}

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

function naechsterTagIso(datum: string): string {
  const [jj, mm, tt] = datum.split("-").map(Number);
  const d = new Date(jj, mm - 1, tt + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Wie gruppiereEintraegeProTag, aber für den externen Proberaum-Kalender -
// ein Termin kann mehrere Tage abdecken (datum bis datumBis inklusiv), taucht
// dann an jedem dieser Tage auf.
export function gruppiereProberaumProTag(
  termine: ProberaumTermin[]
): Map<string, ProberaumTermin[]> {
  const map = new Map<string, ProberaumTermin[]>();
  for (const termin of termine) {
    let tag = termin.datum;
    while (tag <= termin.datumBis) {
      const liste = map.get(tag) ?? [];
      liste.push(termin);
      map.set(tag, liste);
      tag = naechsterTagIso(tag);
    }
  }
  return map;
}

// Urlaube pro Tag (von bis inklusiv), begrenzt auf den sichtbaren Bereich -
// offene/lange Zeiträume erzeugen so keine unnötigen Einträge außerhalb des
// Kalenders.
export function gruppiereUrlaubeProTag(
  urlaube: UrlaubMitName[],
  vonIso: string,
  bisIso: string
): Map<string, UrlaubMitName[]> {
  const map = new Map<string, UrlaubMitName[]>();
  for (const urlaub of urlaube) {
    let tag = urlaub.von < vonIso ? vonIso : urlaub.von;
    const ende = urlaub.bis > bisIso ? bisIso : urlaub.bis;
    while (tag <= ende) {
      const liste = map.get(tag) ?? [];
      liste.push(urlaub);
      map.set(tag, liste);
      tag = naechsterTagIso(tag);
    }
  }
  return map;
}

// Ein einzelnes Vorkommen eines (ggf. wiederkehrenden) Termins. `datum` ist
// das konkrete Datum dieses Vorkommens - bei einmaligen Terminen == termin.datum,
// bei Serien der jeweilige Wiederholungstag. `datumBis` nur bei einmaligen,
// mehrtägigen Terminen gesetzt.
export type TerminVorkommen = {
  termin: KalenderTermin;
  datum: string;
  datumBis: string | null;
};

function addMonateIso(datum: string, n: number): string {
  const [jj, mm, tt] = datum.split("-").map(Number);
  const d = new Date(jj, mm - 1 + n, tt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function naechstesVorkommen(datum: string, wiederholung: KalenderTermin["wiederholung"]): string | null {
  switch (wiederholung) {
    case "woechentlich":
      return addTageIso(datum, 7);
    case "zweiwoechentlich":
      return addTageIso(datum, 14);
    case "monatlich":
      return addMonateIso(datum, 1);
    default:
      return null;
  }
}

function addTageIso(datum: string, n: number): string {
  const [jj, mm, tt] = datum.split("-").map(Number);
  const d = new Date(jj, mm - 1, tt + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Löst selbst angelegte Termine (inkl. Wiederholungen) in einzelne Vorkommen
// im sichtbaren Zeitraum [vonIso, bisIso] auf und gruppiert sie pro Tag.
// Wiederkehrende Termine werden NICHT als Zeilen gespeichert, sondern hier
// jeweils bis zum Rand des sichtbaren Bereichs (bzw. wiederholung_bis) erzeugt.
export function gruppiereTermineProTag(
  termine: KalenderTermin[],
  vonIso: string,
  bisIso: string
): Map<string, TerminVorkommen[]> {
  const map = new Map<string, TerminVorkommen[]>();
  const hinzufuegen = (tag: string, vorkommen: TerminVorkommen) => {
    const liste = map.get(tag) ?? [];
    liste.push(vorkommen);
    map.set(tag, liste);
  };

  for (const termin of termine) {
    if (termin.wiederholung === "einmalig") {
      const ende = termin.datum_bis ?? termin.datum;
      let tag = termin.datum > vonIso ? termin.datum : vonIso;
      const letzterTag = ende < bisIso ? ende : bisIso;
      while (tag <= letzterTag) {
        hinzufuegen(tag, { termin, datum: termin.datum, datumBis: termin.datum_bis });
        tag = naechsterTagIso(tag);
      }
      continue;
    }

    // Serie: Startdatum in Schritten weiterrücken, bis Serienende oder Rand des
    // sichtbaren Bereichs erreicht ist. guard verhindert Endlosschleifen.
    const serienEnde =
      termin.wiederholung_bis && termin.wiederholung_bis < bisIso
        ? termin.wiederholung_bis
        : bisIso;
    let start: string | null = termin.datum;
    let guard = 0;
    while (start && start <= serienEnde && guard < 1000) {
      if (start >= vonIso) {
        hinzufuegen(start, { termin, datum: start, datumBis: null });
      }
      start = naechstesVorkommen(start, termin.wiederholung);
      guard += 1;
    }
  }

  return map;
}

// Kommende Vorkommen ab `abIso` (inkl.), über alle Termine hinweg und über
// Wiederholungen expandiert, nach Datum + Uhrzeit sortiert und auf `limit`
// begrenzt. Mit `filter` z. B. nur Proben. Ein fester Horizont begrenzt die
// Expansion offener Serien (sonst würde eine unbegrenzt wiederkehrende Probe
// endlos laufen).
export function kommendeVorkommen(
  termine: KalenderTermin[],
  abIso: string,
  filter?: (termin: KalenderTermin) => boolean,
  limit = 20
): TerminVorkommen[] {
  const bisIso = addTageIso(abIso, 550); // ~1,5 Jahre voraus
  const alle: TerminVorkommen[] = [];

  for (const termin of termine) {
    if (filter && !filter(termin)) continue;

    if (termin.wiederholung === "einmalig") {
      const ende = termin.datum_bis ?? termin.datum;
      // Auch noch laufende mehrtägige Termine (Start < heute, Ende >= heute)
      // gelten als "kommend".
      if (ende >= abIso && termin.datum <= bisIso) {
        alle.push({ termin, datum: termin.datum, datumBis: termin.datum_bis });
      }
      continue;
    }

    const serienEnde =
      termin.wiederholung_bis && termin.wiederholung_bis < bisIso
        ? termin.wiederholung_bis
        : bisIso;
    let start: string | null = termin.datum;
    let guard = 0;
    while (start && start <= serienEnde && guard < 1000) {
      if (start >= abIso) {
        alle.push({ termin, datum: start, datumBis: null });
      }
      start = naechstesVorkommen(start, termin.wiederholung);
      guard += 1;
    }
  }

  alle.sort((a, b) =>
    a.datum === b.datum
      ? (a.termin.uhrzeit ?? "").localeCompare(b.termin.uhrzeit ?? "")
      : a.datum.localeCompare(b.datum)
  );
  return alle.slice(0, limit);
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
