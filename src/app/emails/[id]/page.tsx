import { notFound } from "next/navigation";
import { BandEmailSection } from "@/components/BandEmailSection";
import {
  getBandEmails,
  getBands,
  getEmailVorlagen,
  getVenuesForBand,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EmailsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ venue?: string }>;
}) {
  const { id } = await params;
  const { venue } = await searchParams;
  const [bands, emails, venues, emailVorlagen] = await Promise.all([
    getBands(),
    getBandEmails(id),
    getVenuesForBand(id),
    getEmailVorlagen(id),
  ]);

  const band = bands.find((b) => b.id === id);
  if (!band) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          E-Mails: {band.name}
        </h1>
      </div>
      <BandEmailSection
        key={venue ?? "kein-venue"}
        bandId={band.id}
        bandName={band.name}
        emails={emails}
        venues={venues}
        vorausgewaehlteVenueId={venue}
        vorlagen={emailVorlagen}
      />
    </div>
  );
}
