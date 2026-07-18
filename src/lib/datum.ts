// Extrahiert ein Datum aus Freitext-Terminangaben von Google Events (SerpApi
// läuft mit hl=de/gl=de, liefert Termine daher meist im Format
// "12. September 2026" oder "Sa., 12. Sept., 19:00 Uhr" - teils ohne Jahr,
// teils englisch). Reine Heuristik zur Vorbefüllung; der Rohtext bleibt
// zusätzlich in den Notizen erhalten, falls der Nutzer nachsehen/korrigieren muss.

const MONATE: Record<string, number> = {
  jan: 0, januar: 0, january: 0,
  feb: 1, februar: 1, february: 1,
  mrz: 2, mär: 2, märz: 2, maerz: 2, mar: 2, march: 2,
  apr: 3, april: 3,
  mai: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9,
  nov: 10, november: 10,
  dez: 11, dezember: 11, dec: 11, december: 11,
};

export function extrahiereVeranstaltungsdatum(
  text: string | null | undefined,
  // Google Events zeigt nur kommende Termine - liegt der geratene Tag ohne
  // Jahresangabe schon in der Vergangenheit, ist sicher das nächste Jahr
  // gemeint. Bei Freitext-Fallbacks (z. B. eine Google-Websuche-Beschreibung
  // wie "Vom 8. Juli bis zum 2. September ...") gilt das nicht: Der Text kann
  // eine bereits laufende Saison beschreiben, ein Vorrücken aufs nächste Jahr
  // wäre dann falsch. Daher hier standardmäßig aus, nur die Events-Quelle
  // schaltet es explizit ein.
  { naechstesJahrWennVergangen = false }: { naechstesJahrWennVergangen?: boolean } = {}
): string | null {
  if (!text) return null;

  let tag: number;
  let monatName: string;
  let jahr: number | null;

  // Deutsches Format: "12. September 2026" / "12. Sept., 19:00 Uhr" - bei
  // Datumsbereichen ("Fr., 4. – So., 6. Sept.") wird bewusst der erste Tag
  // genommen (Beginn der Veranstaltung), der zweite Tag + Wochentag dazwischen
  // wird überlesen.
  let treffer = text.match(
    /(\d{1,2})\.\s*(?:[–-][^\d]{0,20}\d{1,2}\.\s*)?([A-Za-zÀ-ÿ]+)\.?\s*(\d{4})?/
  );
  if (treffer) {
    tag = Number(treffer[1]);
    monatName = treffer[2];
    jahr = treffer[3] ? Number(treffer[3]) : null;
  } else {
    // Englisches Format: "September 12, 2026" / "Sep 12"
    treffer = text.match(
      /([A-Za-zÀ-ÿ]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/
    );
    if (!treffer) return null;
    monatName = treffer[1];
    tag = Number(treffer[2]);
    jahr = treffer[3] ? Number(treffer[3]) : null;
  }

  const monat = MONATE[monatName.toLowerCase()];
  if (monat === undefined || !tag || tag < 1 || tag > 31) return null;

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  let datum = new Date(jahr ?? heute.getFullYear(), monat, tag);

  if (!jahr && naechstesJahrWennVergangen && datum < heute) {
    datum = new Date(heute.getFullYear() + 1, monat, tag);
  }

  // Bewusst nicht toISOString() - das würde über UTC konvertieren und je nach
  // Zeitzone (z. B. Deutschland, UTC+1/+2) einen Tag zurückfallen. Der
  // Kalendertag wird stattdessen direkt aus den lokalen Feldern gebaut.
  const jj = datum.getFullYear();
  const mm = String(datum.getMonth() + 1).padStart(2, "0");
  const tt = String(datum.getDate()).padStart(2, "0");
  return `${jj}-${mm}-${tt}`;
}
