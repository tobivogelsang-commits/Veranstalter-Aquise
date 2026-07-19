import "server-only";

export type ProberaumTermin = {
  id: string;
  titel: string;
  datum: string; // yyyy-MM-dd, erster blockierter Tag
  datumBis: string; // yyyy-MM-dd, letzter blockierter Tag (inklusiv)
};

function icsDatumZuIso(icsDatum: string): string {
  return `${icsDatum.slice(0, 4)}-${icsDatum.slice(4, 6)}-${icsDatum.slice(6, 8)}`;
}

function vorherigerTag(datum: string): string {
  const [jj, mm, tt] = datum.split("-").map(Number);
  const d = new Date(jj, mm - 1, tt - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function entschluesselIcsText(text: string): string {
  return text
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

// Reicht für dieses eine, bekannte SabreDAV-Export (nur ganztägige, nicht
// wiederkehrende VEVENTs, keine gefalteten Zeilen) - kein voller iCal-Parser.
function parseVevents(ics: string): ProberaumTermin[] {
  const bloecke = ics.split("BEGIN:VEVENT").slice(1);
  const termine: ProberaumTermin[] = [];

  for (const block of bloecke) {
    const uid = block.match(/\nUID:(.+)/)?.[1]?.trim();
    const summary = block.match(/\nSUMMARY:(.+)/)?.[1]?.trim();
    const dtstart = block.match(/\nDTSTART[^:]*:(\d{8})/)?.[1];
    const dtend = block.match(/\nDTEND[^:]*:(\d{8})/)?.[1];
    if (!uid || !dtstart) continue;

    const start = icsDatumZuIso(dtstart);
    // DTEND ist bei ganztägigen Terminen exklusiv (Folgetag) - ein Tag
    // zurückrechnen für den letzten tatsächlich blockierten Tag.
    const endeExklusiv = dtend ? icsDatumZuIso(dtend) : start;
    const ende = endeExklusiv > start ? vorherigerTag(endeExklusiv) : start;

    termine.push({
      id: uid,
      titel: summary ? entschluesselIcsText(summary) : "Proberaum belegt",
      datum: start,
      datumBis: ende,
    });
  }

  return termine;
}

// Holt den externen Proberaum-Belegungskalender (Nextcloud-Freigabelink) und
// zeigt die Termine in beiden In-App-Kalendern an (Desktop + Team-App) -
// bewusst getrennt von den Gig-Daten, damit sie nicht ins private
// .ics-Kalender-Abo der Bands gelangen (siehe /api/kalender/[bandId]).
// Wird per Next.js fetch-Cache eine Stunde lang wiederverwendet, statt bei
// jedem Seitenaufruf neu abzurufen - passend zum eigenen 4h-Rhythmus der Quelle.
export async function getProberaumTermine(): Promise<ProberaumTermin[]> {
  const url = process.env.PROBERAUM_ICAL_URL;
  if (!url) return [];

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const text = await res.text();
    return parseVevents(text);
  } catch (err) {
    console.error("Proberaum-Kalender konnte nicht geladen werden", err);
    return [];
  }
}
