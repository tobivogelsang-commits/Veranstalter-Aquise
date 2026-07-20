import { NextResponse } from "next/server";
import { beantworteAnfrage } from "@/lib/teamActions";

// Wird vom Service Worker (public/team-sw.js) direkt per fetch() aufgerufen,
// wenn jemand einen Action-Button auf der Push-Benachrichtigung antippt -
// braucht deshalb einen normalen Route Handler statt einer Server Action
// (Server Actions lassen sich nicht per einfachem fetch() aus dem Service
// Worker aufrufen).
export async function POST(request: Request) {
  let body: { anfrageId?: string; mitgliedId?: string; antwort?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, fehler: "Ungültiger Body." }, { status: 400 });
  }

  const { anfrageId, mitgliedId, antwort } = body;
  // Format vorab prüfen: Dieser Endpunkt ist ohne Login erreichbar, deshalb
  // sollen offensichtlich unsinnige Anfragen gar nicht erst die Datenbank
  // erreichen. Die eigentliche Berechtigung (gehört das Mitglied zur Band der
  // Anfrage?) prüft beantworteAnfrage.
  const istUuid = (wert: unknown): wert is string =>
    typeof wert === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wert);

  if (
    !istUuid(anfrageId) ||
    !istUuid(mitgliedId) ||
    (antwort !== "kann" && antwort !== "kann_nicht")
  ) {
    return NextResponse.json(
      { ok: false, fehler: "Fehlende oder ungültige Felder." },
      { status: 400 }
    );
  }

  const ergebnis = await beantworteAnfrage(anfrageId, mitgliedId, antwort);
  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 400 });
}
