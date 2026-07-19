import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { BandForm } from "@/components/BandForm";
import { getEmailEinstellungen } from "@/lib/emailActions";
import { getMitgliederFuerBand } from "@/lib/teamActions";
import {
  getBandDokumentTypen,
  getBandWithMaterialien,
  getEmailVorlagen,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

async function getBasisUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protokoll = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protokoll}://${host}`;
}

export default async function EinstellungenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    band,
    emailEinstellungen,
    teamMitglieder,
    basisUrl,
    emailVorlagen,
    dokumentTypen,
  ] = await Promise.all([
    getBandWithMaterialien(id),
    getEmailEinstellungen(id),
    getMitgliederFuerBand(id),
    getBasisUrl(),
    getEmailVorlagen(id),
    getBandDokumentTypen(id),
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
        teamInviteUrl={teamInviteUrl}
        teamQrCodeDataUrl={teamQrCodeDataUrl}
        teamMitglieder={teamMitglieder}
        emailVorlagen={emailVorlagen}
        dokumentTypen={dokumentTypen}
      />
    </div>
  );
}
