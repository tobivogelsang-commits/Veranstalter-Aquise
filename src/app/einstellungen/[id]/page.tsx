import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { BandForm } from "@/components/BandForm";
import { BandLogoPanel } from "@/components/BandLogoPanel";
import { AngebotBausteinePanel } from "@/components/AngebotBausteinePanel";
import { BandLoeschenPanel } from "@/components/BandLoeschenPanel";
import { getEmailEinstellungen } from "@/lib/emailActions";
import { getBandLogoUrl, getMitgliederFuerBand } from "@/lib/teamActions";
import {
  getBandDokumentTypen,
  getAngebotBausteine,
  getBandLoeschUmfang,
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
    bandLogoUrl,
    loeschUmfang,
    bausteine,
  ] = await Promise.all([
    getBandWithMaterialien(id),
    getEmailEinstellungen(id),
    getMitgliederFuerBand(id),
    getBasisUrl(),
    getEmailVorlagen(id),
    getBandDokumentTypen(id),
    getBandLogoUrl(id),
    getBandLoeschUmfang(id),
    getAngebotBausteine(id),
  ]);

  if (!band) notFound();

  const teamInviteUrl = `${basisUrl}/team/${id}`;
  const teamQrCodeDataUrl = await QRCode.toDataURL(teamInviteUrl, { margin: 1 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{band.name}</h1>
      </div>
      <BandLogoPanel bandId={band.id} bandName={band.name} logoUrl={bandLogoUrl} />
      <BandForm
        band={band}
        emailEinstellungen={emailEinstellungen}
        teamInviteUrl={teamInviteUrl}
        teamQrCodeDataUrl={teamQrCodeDataUrl}
        teamMitglieder={teamMitglieder}
        emailVorlagen={emailVorlagen}
        dokumentTypen={dokumentTypen}
      />
      <AngebotBausteinePanel bandId={band.id} initialBausteine={bausteine} />
      <BandLoeschenPanel bandId={band.id} bandName={band.name} umfang={loeschUmfang} />
    </div>
  );
}
