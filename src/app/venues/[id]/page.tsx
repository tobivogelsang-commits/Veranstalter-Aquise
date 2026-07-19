import { notFound } from "next/navigation";
import { VenueForm } from "@/components/VenueForm";
import {
  getBandDokumentTypen,
  getBandMitgliederAnzahlProBand,
  getBands,
  getEmailsForVenue,
  getEmailVorlagen,
  getGigAnfragenFuerVenues,
  getVenueBandDokumente,
  getVenueBandProtokoll,
  getVenueWithRelations,
} from "@/lib/queries";
import type { BandDokumentTyp, EmailVorlage } from "@/lib/types";

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

  const [
    anfragen,
    mitgliederProBand,
    vorlagenProBandListe,
    dokumentTypenListe,
    dokumente,
    protokoll,
  ] = await Promise.all([
    getGigAnfragenFuerVenues([id]),
    getBandMitgliederAnzahlProBand(),
    Promise.all(bands.map((band) => getEmailVorlagen(band.id))),
    Promise.all(bands.map((band) => getBandDokumentTypen(band.id))),
    getVenueBandDokumente(id),
    getVenueBandProtokoll(id),
  ]);

  const vorlagenProBand: Record<string, EmailVorlage[]> = {};
  const dokumentTypenProBand: Record<string, BandDokumentTyp[]> = {};
  bands.forEach((band, i) => {
    vorlagenProBand[band.id] = vorlagenProBandListe[i];
    dokumentTypenProBand[band.id] = dokumentTypenListe[i];
  });

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
        vorlagenProBand={vorlagenProBand}
        dokumentTypenProBand={dokumentTypenProBand}
        dokumente={dokumente}
        protokoll={protokoll}
      />
    </div>
  );
}
