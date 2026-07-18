import { notFound } from "next/navigation";
import { VenueForm } from "@/components/VenueForm";
import {
  getBandMitgliederAnzahlProBand,
  getBands,
  getEmailsForVenue,
  getGigAnfragenFuerVenues,
  getVenueWithRelations,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [venue, bands, emails] = await Promise.all([
    getVenueWithRelations(id),
    getBands(),
    getEmailsForVenue(id),
  ]);

  if (!venue) notFound();

  const [anfragen, mitgliederProBand] = await Promise.all([
    getGigAnfragenFuerVenues([id]),
    getBandMitgliederAnzahlProBand(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{venue.name}</h1>
      </div>
      <VenueForm
        bands={bands}
        venue={venue}
        emails={emails}
        anfragen={anfragen}
        mitgliederProBand={mitgliederProBand}
      />
    </div>
  );
}
