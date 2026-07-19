import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBandName } from "@/lib/teamActions";
import {
  getBandSongs,
  getKalenderEintraege,
  getSetlistenMitSongs,
  getVenuesWithRelations,
} from "@/lib/queries";
import { TeamApp } from "@/components/TeamApp";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bandId: string }>;
}): Promise<Metadata> {
  const { bandId } = await params;
  const bandName = (await getBandName(bandId)) ?? "Team";

  return {
    title: `${bandName} – Team`,
    manifest: `/api/team-manifest/${bandId}`,
  };
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ bandId: string }>;
  searchParams: Promise<{
    tab?: string;
    ansicht?: string;
    monat?: string;
    jahr?: string;
  }>;
}) {
  const { bandId } = await params;
  const { tab, ansicht, monat, jahr } = await searchParams;

  const [bandName, venues, songs, setlisten] = await Promise.all([
    getBandName(bandId),
    getVenuesWithRelations(),
    getBandSongs(bandId),
    getSetlistenMitSongs(bandId),
  ]);

  if (!bandName) notFound();

  const kalenderEintraege = getKalenderEintraege(venues, bandId);
  const aktiverTab = tab === "kalender" || tab === "setliste" ? tab : "dashboard";

  return (
    <TeamApp
      bandId={bandId}
      bandName={bandName}
      kalenderEintraege={kalenderEintraege}
      songs={songs}
      setlisten={setlisten}
      aktiverTab={aktiverTab}
      kalenderAnsicht={ansicht === "jahr" ? "jahr" : "monat"}
      monatParam={monat}
      jahrParam={jahr}
    />
  );
}
