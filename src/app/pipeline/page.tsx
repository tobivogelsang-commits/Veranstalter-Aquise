import { KanbanBoard } from "@/components/KanbanBoard";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import { getVenuesWithRelations, toPipelineEntries } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ band?: string }>;
}) {
  const { band } = await searchParams;
  const bandFilter = band ?? ALLE_BANDS_PARAM;

  const venues = await getVenuesWithRelations();
  const entries = toPipelineEntries(venues, bandFilter);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-500">
          Karten per Drag & Drop zwischen Status verschieben.
        </p>
      </div>
      <KanbanBoard entries={entries} bandFilter={bandFilter} />
    </div>
  );
}
