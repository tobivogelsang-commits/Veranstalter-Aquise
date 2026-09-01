import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { requireFreigabe } from "@/lib/authServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BELEG_BUCKET } from "@/lib/storage";
import { ALLE_BANDS_PARAM } from "@/lib/constants";

// Alle Beleg-Dateien eines Jahres als ZIP (fuer den Steuerberater).
// Dateinamen: <Datum>_<Band>_<Haendler>_<lfd>.<endung> - so sortiert sich
// das Archiv von selbst chronologisch.
export async function GET(request: Request) {
  await requireFreigabe("buchhaltung_ansehen");
  const url = new URL(request.url);
  const bandFilter = url.searchParams.get("band") ?? ALLE_BANDS_PARAM;
  const jahr = Number(url.searchParams.get("jahr")) || new Date().getFullYear();

  const [bands, belege] = await Promise.all([
    supabaseAdmin.from("bands").select("id, name"),
    supabaseAdmin
      .from("belege")
      .select("*")
      .not("datei_pfad", "is", null)
      .order("datum"),
  ]);
  const bandName = (id: string) =>
    bands.data?.find((b) => b.id === id)?.name ?? "band";

  const passend = (belege.data ?? []).filter(
    (b) =>
      (bandFilter === ALLE_BANDS_PARAM || b.band_id === bandFilter) &&
      new Date(b.datum).getFullYear() === jahr
  );
  if (passend.length === 0) {
    return NextResponse.json(
      { fehler: `Keine Beleg-Dateien für ${jahr} vorhanden.` },
      { status: 404 }
    );
  }

  const sauber = (text: string) =>
    text.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, "").trim().replaceAll(" ", "-") || "beleg";

  const eintraege: Record<string, Uint8Array> = {};
  let lfd = 0;
  for (const beleg of passend) {
    const { data } = await supabaseAdmin.storage
      .from(BELEG_BUCKET)
      .download(beleg.datei_pfad!);
    if (!data) continue;
    lfd += 1;
    const endung = beleg.datei_pfad!.split(".").pop() ?? "bin";
    const name = `${beleg.datum}_${sauber(bandName(beleg.band_id))}_${sauber(
      beleg.haendler ?? beleg.kategorie
    )}_${String(lfd).padStart(3, "0")}.${endung}`;
    eintraege[name] = new Uint8Array(await data.arrayBuffer());
  }

  if (Object.keys(eintraege).length === 0) {
    return NextResponse.json(
      { fehler: "Beleg-Dateien konnten nicht geladen werden." },
      { status: 500 }
    );
  }

  const zip = zipSync(eintraege);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="belege-${jahr}.zip"`,
    },
  });
}
