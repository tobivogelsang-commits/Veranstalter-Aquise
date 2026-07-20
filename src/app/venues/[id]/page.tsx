import { notFound } from "next/navigation";
import { VenueForm } from "@/components/VenueForm";
import {
  getBandDokumentTypen,
  getBandMaterialien,
  getBandMitgliederAnzahlProBand,
  getBands,
  getEmailsForVenue,
  getEmailVorlagen,
  getGigAnfragenFuerVenues,
  getSetlistenMitSongs,
  getVenueBandDokumente,
  getVenueBandProtokoll,
  getVenueWithRelations,
  type SetlisteMitSongs,
} from "@/lib/queries";
import type { BandDokumentTypMitUrl, BandMaterial, EmailVorlage } from "@/lib/types";

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
    materialienProBandListe,
    setlistenProBandListe,
    dokumente,
    protokoll,
  ] = await Promise.all([
    getGigAnfragenFuerVenues([id]),
    getBandMitgliederAnzahlProBand(),
    Promise.all(bands.map((band) => getEmailVorlagen(band.id))),
    Promise.all(bands.map((band) => getBandDokumentTypen(band.id))),
    Promise.all(bands.map((band) => getBandMaterialien(band.id))),
    Promise.all(bands.map((band) => getSetlistenMitSongs(band.id))),
    getVenueBandDokumente(id),
    getVenueBandProtokoll(id),
  ]);

  const vorlagenProBand: Record<string, EmailVorlage[]> = {};
  const dokumentTypenProBand: Record<string, BandDokumentTypMitUrl[]> = {};
  const materialienProBand: Record<string, BandMaterial[]> = {};
  const setlistenProBand: Record<string, SetlisteMitSongs[]> = {};
  bands.forEach((band, i) => {
    vorlagenProBand[band.id] = vorlagenProBandListe[i];
    dokumentTypenProBand[band.id] = dokumentTypenListe[i];
    materialienProBand[band.id] = materialienProBandListe[i];
    setlistenProBand[band.id] = setlistenProBandListe[i];
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
        materialienProBand={materialienProBand}
        setlistenProBand={setlistenProBand}
        dokumente={dokumente}
        protokoll={protokoll}
      />
    </div>
  );
}
