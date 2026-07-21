import { NextResponse } from "next/server";
import { beantworteTermin } from "@/lib/teamActions";

// Vom Service Worker (public/team-sw.js) per fetch() aufgerufen, wenn jemand
// einen Action-Button auf der Termin-Push-Benachrichtigung antippt. Analog zu
// /api/team-antwort, nur für selbst angelegte Termine (pro Vorkommen).
export async function POST(request: Request) {
  let body: {
    terminId?: string;
    vorkommenDatum?: string;
    mitgliedId?: string;
    bandId?: string;
    antwort?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, fehler: "Ungültiger Body." }, { status: 400 });
  }

  const { terminId, vorkommenDatum, mitgliedId, bandId, antwort } = body;

  const istUuid = (wert: unknown): wert is string =>
    typeof wert === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wert);
  const istDatum = (wert: unknown): wert is string =>
    typeof wert === "string" && /^\d{4}-\d{2}-\d{2}$/.test(wert);

  if (
    !istUuid(terminId) ||
    !istDatum(vorkommenDatum) ||
    !istUuid(mitgliedId) ||
    !istUuid(bandId) ||
    (antwort !== "kann" && antwort !== "kann_nicht")
  ) {
    return NextResponse.json(
      { ok: false, fehler: "Fehlende oder ungültige Felder." },
      { status: 400 }
    );
  }

  const ergebnis = await beantworteTermin(terminId, vorkommenDatum, mitgliedId, bandId, antwort);
  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 400 });
}
