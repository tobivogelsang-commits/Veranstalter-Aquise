import { NextResponse } from "next/server";
import { getBandLogoUrl, getBandName } from "@/lib/teamActions";

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
  const logoUrl = await getBandLogoUrl(bandId);

  // sizes: "any" - das hochgeladene Logo wird nicht skaliert, seine echten
  // Maße sind hier unbekannt. Beide Plattformen kommen damit zurecht und
  // skalieren selbst; deshalb sollte das Logo möglichst quadratisch sein.
  const icons = logoUrl
    ? [{ src: logoUrl, sizes: "any" }]
    : [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }];

  return NextResponse.json(
    {
      name: `${bandName} – Team`,
      short_name: bandName,
      description: "Verfügbarkeit bestätigen und Gig-Kalender ansehen.",
      start_url: `/team/${bandId}`,
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#0f172a",
      icons,
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
