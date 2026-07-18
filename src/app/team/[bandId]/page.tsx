import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBandName } from "@/lib/teamActions";
import { getKalenderEintraege, getVenuesWithRelations } from "@/lib/queries";
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
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;

  const [bandName, venues] = await Promise.all([
    getBandName(bandId),
    getVenuesWithRelations(),
  ]);

  if (!bandName) notFound();

  const kalenderEintraege = getKalenderEintraege(venues, bandId);

  return (
    <TeamApp bandId={bandId} bandName={bandName} kalenderEintraege={kalenderEintraege} />
  );
}
