import { notFound } from "next/navigation";
import { MerchVerwaltung } from "@/components/MerchVerwaltung";
import { getBands, getMerchArtikel, getMerchVorlagen } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MerchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bands, artikel, vorlagen] = await Promise.all([
    getBands(),
    getMerchArtikel(id),
    getMerchVorlagen(id),
  ]);

  const band = bands.find((b) => b.id === id);
  if (!band) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Merch: {band.name}</h1>
      </div>
      <MerchVerwaltung
        bandId={band.id}
        initialArtikel={artikel}
        initialVorlagen={vorlagen}
      />
    </div>
  );
}
