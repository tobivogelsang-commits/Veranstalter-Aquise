import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBandLogoUrl, getBandName } from "@/lib/teamActions";
import {
  getBandSongs,
  getKalenderEintraege,
  getMerchArtikel,
  getProduktionen,
  getSetlistenMitSongs,
  getTermine,
  getTerminSongs,
  getTerminTeilnahme,
  getUrlaube,
  getVenuesWithRelations,
} from "@/lib/queries";
import { getProberaumTermine } from "@/lib/proberaumKalender";
import { TeamApp } from "@/components/TeamApp";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bandId: string }>;
}): Promise<Metadata> {
  const { bandId } = await params;
  const bandName = (await getBandName(bandId)) ?? "Team";
  const logoUrl = await getBandLogoUrl(bandId);

  return {
    title: `${bandName} – Team`,
    manifest: `/api/team-manifest/${bandId}`,
    icons: logoUrl ? { apple: logoUrl, icon: logoUrl } : undefined,
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

  const [
    bandName,
    venues,
    songs,
    setlisten,
    produktionen,
    proberaumTermine,
    termine,
    terminTeilnahme,
    terminSongs,
    urlaube,
    merchArtikel,
  ] = await Promise.all([
    getBandName(bandId),
    getVenuesWithRelations(),
    getBandSongs(bandId),
    getSetlistenMitSongs(bandId),
    getProduktionen(bandId),
    getProberaumTermine(),
    getTermine(bandId),
    getTerminTeilnahme(bandId),
    getTerminSongs(bandId),
    getUrlaube(bandId),
    getMerchArtikel(bandId),
  ]);

  if (!bandName) notFound();

  const kalenderEintraege = getKalenderEintraege(venues, bandId);
  const aktiverTab =
    tab === "kalender" || tab === "setliste" || tab === "produktion" || tab === "merch"
      ? tab
      : "dashboard";
  const logoUrl = await getBandLogoUrl(bandId);

  return (
    <TeamApp
      bandId={bandId}
      bandName={bandName}
      logoUrl={logoUrl}
      kalenderEintraege={kalenderEintraege}
      songs={songs}
      setlisten={setlisten}
      produktionen={produktionen}
      aktiverTab={aktiverTab}
      kalenderAnsicht={ansicht === "jahr" ? "jahr" : "monat"}
      monatParam={monat}
      jahrParam={jahr}
      proberaumTermine={proberaumTermine}
      termine={termine}
      terminTeilnahme={terminTeilnahme}
      terminSongs={terminSongs}
      urlaube={urlaube}
      merchArtikel={merchArtikel}
    />
  );
}
