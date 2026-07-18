import Link from "next/link";
import { VenueFilters } from "@/components/VenueFilters";
import { VenueTable } from "@/components/VenueTable";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import {
  filterVenues,
  getDistinctRegionen,
  getVenuesWithRelations,
} from "@/lib/queries";
import type { Status, VenueTyp } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    band?: string;
    typ?: string;
    region?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const bandFilter = params.band ?? ALLE_BANDS_PARAM;

  const venues = await getVenuesWithRelations();
  const regionen = getDistinctRegionen(venues);

  const gefiltert = filterVenues(venues, {
    band: bandFilter,
    typ: (params.typ as VenueTyp) || "",
    region: params.region || "",
    status: (params.status as Status) || "",
    suche: params.q || "",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Veranstalter</h1>
          <p className="mt-1 text-sm text-slate-500">
            {gefiltert.length} von {venues.length} Veranstaltern
          </p>
        </div>
        <Link
          href="/venues/new"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Veranstalter anlegen
        </Link>
      </div>

      <VenueFilters regionen={regionen} />

      <VenueTable venues={gefiltert} bandFilter={bandFilter} />
    </div>
  );
}
