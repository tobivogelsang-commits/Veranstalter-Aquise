import { NextResponse } from "next/server";
import { requireFreigabe } from "@/lib/authServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBandLogoUrl } from "@/lib/teamActions";
import { erzeugeAngebotPdf } from "@/lib/angebotPdf";

// Liefert das Angebots-PDF frisch erzeugt aus (statt die gespeicherte Datei
// auszuliefern) - so stimmt die Vorschau immer mit dem aktuellen Stand überein.
// Die gespeicherte Fassung im Storage ist die, die an E-Mails gehängt wird.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireFreigabe("angebote_ansehen");
  const { id } = await params;

  const { data: angebot } = await supabaseAdmin
    .from("angebote")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!angebot) {
    return NextResponse.json({ fehler: "Angebot nicht gefunden." }, { status: 404 });
  }

  const { data: band } = await supabaseAdmin
    .from("bands")
    .select("*")
    .eq("id", angebot.band_id)
    .maybeSingle();
  if (!band) {
    return NextResponse.json({ fehler: "Band nicht gefunden." }, { status: 404 });
  }

  const logoUrl = await getBandLogoUrl(band.id);
  const buffer = await erzeugeAngebotPdf(angebot, band, logoUrl);
  const dateiname = `${angebot.titel} ${angebot.nummer}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(dateiname)}"`,
    },
  });
}
