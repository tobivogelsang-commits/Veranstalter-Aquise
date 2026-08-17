import { NextResponse } from "next/server";
import {
  getBands,
  getKalenderEintraege,
  getTermine,
  getVenuesWithRelations,
} from "@/lib/queries";
import { TERMIN_TYP_LABEL } from "@/lib/constants";
import type { KalenderTermin } from "@/lib/types";

export const dynamic = "force-dynamic";

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatDatum(datum: string): string {
  return datum.replace(/-/g, "");
}

// iCal-Enddatum bei ganztägigen Terminen ist exklusiv - der Folgetag.
function naechsterTag(datum: string): string {
  const [jahr, monat, tag] = datum.split("-").map(Number);
  const naechster = new Date(jahr, monat - 1, tag + 1);
  const jj = naechster.getFullYear();
  const mm = String(naechster.getMonth() + 1).padStart(2, "0");
  const tt = String(naechster.getDate()).padStart(2, "0");
  return `${jj}${mm}${tt}`;
}

// Wiederholungen als RRULE. Die App kennt nur diese vier Fälle; "einmalig"
// bekommt gar keine Regel.
function rrule(termin: KalenderTermin): string | null {
  // UNTIL muss dasselbe Format haben wie DTSTART (RFC 5545): bei einem Termin
  // mit Uhrzeit also Datum UND Zeit, sonst verwerfen strenge Kalender-Apps die
  // ganze Regel. Ende des Tages, damit das letzte Vorkommen noch hineinfaellt.
  const bis = termin.wiederholung_bis
    ? `;UNTIL=${formatDatum(termin.wiederholung_bis)}${termin.uhrzeit ? "T235959" : ""}`
    : "";
  switch (termin.wiederholung) {
    case "woechentlich":
      return `RRULE:FREQ=WEEKLY${bis}`;
    case "zweiwoechentlich":
      return `RRULE:FREQ=WEEKLY;INTERVAL=2${bis}`;
    case "monatlich":
      return `RRULE:FREQ=MONTHLY${bis}`;
    default:
      return null;
  }
}

// Termine mit Uhrzeit werden bewusst OHNE Zeitzone geschrieben ("floating
// time"): Der Kalender des Geräts liest sie als Ortszeit. Für eine Band, die
// zusammen an einem Ort probt, ist das genau richtig und erspart eine
// VTIMEZONE-Definition, die manche Kalender-Apps eigenwillig auslegen.
function terminEvent(termin: KalenderTermin, jetzt: string): string {
  const zeilen = ["BEGIN:VEVENT", `UID:termin-${termin.id}@veranstalter-akquise`, `DTSTAMP:${jetzt}`];

  if (termin.uhrzeit) {
    const start = `${formatDatum(termin.datum)}T${termin.uhrzeit.slice(0, 5).replace(":", "")}00`;
    zeilen.push(`DTSTART:${start}`);
    // Die App erfasst keine Endzeit. Zwei Stunden sind für Probe/Event eine
    // brauchbare Annahme - ein Punkttermin ohne Dauer sieht in Kalender-Apps
    // aus wie ein Versehen.
    zeilen.push("DURATION:PT2H");
  } else {
    zeilen.push(`DTSTART;VALUE=DATE:${formatDatum(termin.datum)}`);
    zeilen.push(
      `DTEND;VALUE=DATE:${naechsterTag(termin.datum_bis ?? termin.datum)}`
    );
  }

  const regel = rrule(termin);
  if (regel) {
    zeilen.push(regel);
    // Einzeln abgesagte Vorkommen einer Serie ausnehmen.
    if (termin.ausnahmen.length > 0) {
      const wert = termin.ausnahmen.map(formatDatum);
      zeilen.push(
        termin.uhrzeit
          ? `EXDATE:${wert
              .map((d) => `${d}T${termin.uhrzeit!.slice(0, 5).replace(":", "")}00`)
              .join(",")}`
          : `EXDATE;VALUE=DATE:${wert.join(",")}`
      );
    }
  }

  zeilen.push(`SUMMARY:${escapeIcs(termin.titel)}`);
  const beschreibung = [TERMIN_TYP_LABEL[termin.typ], termin.notiz]
    .filter(Boolean)
    .join(" · ");
  if (beschreibung) zeilen.push(`DESCRIPTION:${escapeIcs(beschreibung)}`);
  if (termin.ort) zeilen.push(`LOCATION:${escapeIcs(termin.ort)}`);
  zeilen.push("END:VEVENT");
  return zeilen.join("\r\n");
}

// Liefert einen .ics-Feed pro Band zum Abonnieren in privaten Kalender-Apps
// (Apple/Google/Outlook "Kalender per URL hinzufügen"). Enthält beides, was
// auch die App im Kalender zeigt: gebuchte/interessierte Gigs UND die selbst
// angelegten Termine samt Wiederholungen - ein Feed, der nur die Gigs kennt,
// waere fuer eine Band ohne anstehenden Gig schlicht leer.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bandId: string }> }
) {
  const { bandId } = await params;

  const [bands, venues] = await Promise.all([getBands(), getVenuesWithRelations()]);
  const band = bands.find((b) => b.id === bandId);
  if (!band) {
    return new NextResponse("Band nicht gefunden.", { status: 404 });
  }

  const termine = await getTermine(bandId);
  const eintraege = getKalenderEintraege(venues, bandId).filter(
    (eintrag) => eintrag.venue.veranstaltungsdatum
  );
  const jetzt = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const events = eintraege
    .map((eintrag) => {
      const datum = eintrag.venue.veranstaltungsdatum as string;
      const label = eintrag.relation.status === "gebucht" ? "Gebucht" : "Interessiert";
      return [
        "BEGIN:VEVENT",
        `UID:${eintrag.relation.id}@veranstalter-akquise`,
        `DTSTAMP:${jetzt}`,
        `DTSTART;VALUE=DATE:${formatDatum(datum)}`,
        `DTEND;VALUE=DATE:${naechsterTag(datum)}`,
        `SUMMARY:${escapeIcs(`${label}: ${eintrag.venue.name}`)}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .concat(termine.map((termin) => terminEvent(termin, jetzt)))
    .join("\r\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Veranstalter-Akquise//Team-Kalender//DE",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcs(`${band.name} - Termine`)}`,
    events,
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${band.name}.ics"`,
    },
  });
}
