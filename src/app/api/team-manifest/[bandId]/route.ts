import { NextResponse } from "next/server";
import { getBandName } from "@/lib/teamActions";

// Eigener Route Handler statt app/team/[bandId]/manifest.ts - verschachtelte
// manifest.ts-Dateien unter einem dynamischen Segment werden von dieser
// Next.js-Version nicht als Route registriert (kein Eintrag im Build-Manifest).
// generateMetadata() in page.tsx verlinkt hierher.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bandId: string }> }
) {
  const { bandId } = await params;
  const bandName = (await getBandName(bandId)) ?? "Team";

  return NextResponse.json(
    {
      name: `${bandName} – Team`,
      short_name: bandName,
      description: "Verfügbarkeit bestätigen und Gig-Kalender ansehen.",
      start_url: `/team/${bandId}`,
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#0f172a",
      icons: [
        {
          src: "/favicon.ico",
          sizes: "any",
          type: "image/x-icon",
        },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
