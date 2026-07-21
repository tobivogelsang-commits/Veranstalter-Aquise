import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBandName } from "@/lib/teamActions";
import {
  getBandSongs,
  getKalenderEintraege,
  getSetlistenMitSongs,
  getTermine,
  getTerminTeilnahme,
  getVenuesWithRelations,
} from "@/lib/queries";
import { getProberaumTermine } from "@/lib/proberaumKalender";
import { getTeamIconPfade } from "@/lib/constants";
import { TeamApp } from "@/components/TeamApp";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bandId: string }>;
}): Promise<Metadata> {
  const { bandId } = await params;
  const bandName = (await getBandName(bandId)) ?? "Team";
  const teamIcon = getTeamIconPfade(bandId);

  return {
    title: `${bandName} – Team`,
    manifest: `/api/team-manifest/${bandId}`,
    icons: teamIcon
      ? { apple: teamIcon.gross, icon: teamIcon.klein }
      : undefined,
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

  const [bandName, venues, songs, setlisten, proberaumTermine, termine, terminTeilnahme] =
    await Promise.all([
      getBandName(bandId),
      getVenuesWithRelations(),
      getBandSongs(bandId),
      getSetlistenMitSongs(bandId),
      getProberaumTermine(),
      getTermine(bandId),
      getTerminTeilnahme(bandId),
    ]);

  if (!bandName) notFound();

  const kalenderEintraege = getKalenderEintraege(venues, bandId);
  const aktiverTab = tab === "kalender" || tab === "setliste" ? tab : "dashboard";
  const logoUrl = getTeamIconPfade(bandId)?.klein ?? null;

  return (
    <TeamApp
      bandId={bandId}
      bandName={bandName}
      logoUrl={logoUrl}
      kalenderEintraege={kalenderEintraege}
      songs={songs}
      setlisten={setlisten}
      aktiverTab={aktiverTab}
      kalenderAnsicht={ansicht === "jahr" ? "jahr" : "monat"}
      monatParam={monat}
      jahrParam={jahr}
      proberaumTermine={proberaumTermine}
      termine={termine}
      terminTeilnahme={terminTeilnahme}
    />
  );
}
