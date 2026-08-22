import { VenueForm } from "@/components/VenueForm";
import { getBands } from "@/lib/queries";
import { requireFreigabeSeite } from "@/lib/authServer";

export const dynamic = "force-dynamic";

export default async function NewVenuePage() {
  await requireFreigabeSeite("akquise");
  const bands = await getBands();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Veranstalter anlegen
        </h1>
      </div>
      <VenueForm bands={bands} />
    </div>
  );
}
