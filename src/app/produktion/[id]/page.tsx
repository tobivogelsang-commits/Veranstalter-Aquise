import { notFound } from "next/navigation";
import { ProduktionListe } from "@/components/ProduktionListe";
import { getBands, getProduktionen } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProduktionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bands, produktionen] = await Promise.all([
    getBands(),
    getProduktionen(id),
  ]);

  const band = bands.find((b) => b.id === id);
  if (!band) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Produktion: {band.name}
        </h1>
      </div>
      <ProduktionListe bandId={band.id} initialProduktionen={produktionen} />
    </div>
  );
}
