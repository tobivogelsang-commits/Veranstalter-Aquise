import { NextResponse } from "next/server";
import { getBands, getKalenderEintraege, getVenuesWithRelations } from "@/lib/queries";

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

// Liefert einen .ics-Feed pro Band (gebuchte + interessierte Gigs), zum
// Abonnieren in privaten Kalender-Apps (Apple/Google/Outlook "Kalender per
// URL hinzufügen"). Nutzt dieselbe Filterung wie die In-App-Kalenderansicht.
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
    .join("\r\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Veranstalter-Akquise//Team-Kalender//DE",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcs(`${band.name} - Gigs`)}`,
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
