import Link from "next/link";
import { notFound } from "next/navigation";
import { RechnungEditor } from "@/components/RechnungEditor";
import { requireFreigabeSeite } from "@/lib/authServer";
import {
  getBandDokumentTypen,
  getEmailVorlagen,
  getGagenAnteile,
  getRechnung,
  getVenueVorschlaege,
} from "@/lib/queries";
import { getMitgliederFuerBand } from "@/lib/teamActions";

export const dynamic = "force-dynamic";

export default async function RechnungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFreigabeSeite("buchhaltung_ansehen");
  const { id } = await params;
  const rechnung = await getRechnung(id);
  if (!rechnung) notFound();

  const [venues, vorlagen, dokumentTypen, mitglieder, anteile] = await Promise.all([
    getVenueVorschlaege(),
    getEmailVorlagen(rechnung.band_id),
    getBandDokumentTypen(rechnung.band_id),
    getMitgliederFuerBand(rechnung.band_id),
    getGagenAnteile(id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/buchhaltung"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Buchhaltung
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {rechnung.titel} {rechnung.nummer}
        </h1>
      </div>
      <RechnungEditor
        rechnung={rechnung}
        venues={venues}
        vorlagen={vorlagen}
        dokumentTypen={dokumentTypen}
        mitglieder={mitglieder}
        anteile={anteile}
      />
    </div>
  );
}
