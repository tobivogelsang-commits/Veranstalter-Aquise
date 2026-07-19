import { StatCard } from "@/components/StatCard";
import { FollowUpList } from "@/components/FollowUpList";
import { OffeneTeamAntworten } from "@/components/OffeneTeamAntworten";
import { NeueEmailsWidget } from "@/components/NeueEmailsWidget";
import { AktivitaetsFeedWidget } from "@/components/AktivitaetsFeedWidget";
import { BereitZuBuchenBanner } from "@/components/BereitZuBuchenBanner";
import { BandSwitcher } from "@/components/BandSwitcher";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import {
  getAnstehendeFollowUps,
  getBands,
  getDashboardStats,
  getGigAnfragenFuerVenues,
  getNeuesteEingehendeEmails,
  getNeuesteProtokollEintraege,
  getVenuesWithRelations,
  toPipelineEntries,
} from "@/lib/queries";
import { getMitgliederFuerBand } from "@/lib/teamActions";
import type { BandMitgliedOhnePush } from "@/lib/types";

// Live-Daten pro Request, keine statische Zwischenspeicherung beim Build.
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ band?: string }>;
}) {
  const { band } = await searchParams;
  const bandFilter = band ?? ALLE_BANDS_PARAM;

  const [bands, venues] = await Promise.all([
    getBands(),
    getVenuesWithRelations(),
  ]);

  const stats = getDashboardStats(venues, bands, bandFilter);
  const followUps = getAnstehendeFollowUps(venues, bandFilter);
  const bereitZuBuchen = toPipelineEntries(venues, bandFilter).filter(
    (entry) => entry.relation.status === "bereit_zu_buchen"
  );
  const anzahlFuerStatus = (status: string) =>
    stats.statusVerteilung.find((s) => s.status === status)?.anzahl ?? 0;

  const [alleAnfragen, mitgliederListen, neueEmails, aktivitaeten] = await Promise.all([
    getGigAnfragenFuerVenues(venues.map((v) => v.id)),
    Promise.all(bands.map((b) => getMitgliederFuerBand(b.id))),
    getNeuesteEingehendeEmails(bandFilter, 5),
    getNeuesteProtokollEintraege(bandFilter, 5),
  ]);
  const anfragen = alleAnfragen.filter(
    (a) => bandFilter === ALLE_BANDS_PARAM || a.band_id === bandFilter
  );
  const mitgliederProBand: Record<string, BandMitgliedOhnePush[]> = {};
  bands.forEach((b, i) => {
    mitgliederProBand[b.id] = mitgliederListen[i];
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Überblick über eure Veranstalter-Akquise.
        </p>
        <div className="mt-3">
          <BandSwitcher bands={bands} />
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Kontaktiert" value={anzahlFuerStatus("kontaktiert")} />
        <StatCard label="Interessiert" value={anzahlFuerStatus("interessiert")} />
        <StatCard label="Gebucht" value={anzahlFuerStatus("gebucht")} />
      </section>

      <NeueEmailsWidget emails={neueEmails} />

      <BereitZuBuchenBanner entries={bereitZuBuchen} />

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">Offene Team-Antworten</h2>
        <OffeneTeamAntworten
          anfragen={anfragen}
          venues={venues}
          bands={bands}
          mitgliederProBand={mitgliederProBand}
        />
      </section>

      <AktivitaetsFeedWidget eintraege={aktivitaeten} />

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Anstehende Follow-ups (nächste 7 Tage)
        </h2>
        <FollowUpList entries={followUps} />
      </section>
    </div>
  );
}
