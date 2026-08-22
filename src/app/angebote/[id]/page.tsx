import Link from "next/link";
import { notFound } from "next/navigation";
import { AngebotEditor } from "@/components/AngebotEditor";
import { requireFreigabeSeite } from "@/lib/authServer";
import {
  getAngebot,
  getAngebotBausteine,
  getBandDokumentTypen,
  getEmailVorlagen,
  getVenueVorschlaege,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AngebotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFreigabeSeite("angebote_ansehen");
  const { id } = await params;
  const angebot = await getAngebot(id);
  if (!angebot) notFound();

  const [venues, vorlagen, dokumentTypen, bausteine] = await Promise.all([
    getVenueVorschlaege(),
    getEmailVorlagen(angebot.band_id),
    getBandDokumentTypen(angebot.band_id),
    getAngebotBausteine(angebot.band_id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/angebote" className="text-sm text-slate-500 hover:text-slate-900">
          ← Alle Angebote
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {angebot.titel} {angebot.nummer}
        </h1>
      </div>
      <AngebotEditor
        angebot={angebot}
        venues={venues}
        vorlagen={vorlagen}
        dokumentTypen={dokumentTypen}
        bausteine={bausteine}
      />
    </div>
  );
}
