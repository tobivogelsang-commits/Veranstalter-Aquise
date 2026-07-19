import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { BandForm } from "@/components/BandForm";
import { getEmailEinstellungen } from "@/lib/emailActions";
import { getMitgliederFuerBand } from "@/lib/teamActions";
import {
  getBandEmails,
  getBandWithMaterialien,
  getEmailVorlagen,
  getVenuesForBand,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

async function getBasisUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protokoll = host.startsWith("localhost") ? "http" : "https";
  return `${protokoll}://${host}`;
}

export default async function BandDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ venue?: string }>;
}) {
  const { id } = await params;
  const { venue } = await searchParams;
  const [
    band,
    emailEinstellungen,
    emails,
    venues,
    teamMitglieder,
    basisUrl,
    emailVorlagen,
  ] = await Promise.all([
    getBandWithMaterialien(id),
    getEmailEinstellungen(id),
    getBandEmails(id),
    getVenuesForBand(id),
    getMitgliederFuerBand(id),
    getBasisUrl(),
    getEmailVorlagen(id),
  ]);

  if (!band) notFound();

  const teamInviteUrl = `${basisUrl}/team/${id}`;
  const teamQrCodeDataUrl = await QRCode.toDataURL(teamInviteUrl, { margin: 1 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{band.name}</h1>
      </div>
      <BandForm
        band={band}
        emailEinstellungen={emailEinstellungen}
        emails={emails}
        venues={venues}
        vorausgewaehlteVenueId={venue}
        teamInviteUrl={teamInviteUrl}
        teamQrCodeDataUrl={teamQrCodeDataUrl}
        teamMitglieder={teamMitglieder}
        emailVorlagen={emailVorlagen}
      />
    </div>
  );
}
