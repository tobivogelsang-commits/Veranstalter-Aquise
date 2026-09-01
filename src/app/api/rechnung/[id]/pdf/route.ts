import { NextResponse } from "next/server";
import { requireFreigabe } from "@/lib/authServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBandLogoUrl } from "@/lib/teamActions";
import { erzeugeRechnungPdf } from "@/lib/angebotPdf";

// Rechnungs-PDF, frisch erzeugt (Muster wie /api/angebot/[id]/pdf). Die im
// Storage gespeicherte Fassung ist die, die an E-Mails gehängt wird.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireFreigabe("buchhaltung_ansehen");
  const { id } = await params;

  const { data: rechnung } = await supabaseAdmin
    .from("rechnungen")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rechnung) {
    return NextResponse.json({ fehler: "Rechnung nicht gefunden." }, { status: 404 });
  }

  const { data: band } = await supabaseAdmin
    .from("bands")
    .select("*")
    .eq("id", rechnung.band_id)
    .maybeSingle();
  if (!band) {
    return NextResponse.json({ fehler: "Band nicht gefunden." }, { status: 404 });
  }

  const logoUrl = await getBandLogoUrl(band.id);
  const buffer = await erzeugeRechnungPdf(rechnung, band, logoUrl);
  const dateiname = `${rechnung.titel} ${rechnung.nummer}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(dateiname)}"`,
    },
  });
}
