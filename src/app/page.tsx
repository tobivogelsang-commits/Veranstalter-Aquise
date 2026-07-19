import { StatCard } from "@/components/StatCard";
import { FollowUpList } from "@/components/FollowUpList";
import { TeamAnfragenList } from "@/components/TeamAnfragenList";
import { BereitZuBuchenBanner } from "@/components/BereitZuBuchenBanner";
import { BandSwitcher } from "@/components/BandSwitcher";
import { ALLE_BANDS_PARAM, STATUS_LABELS } from "@/lib/constants";
import {
  getAnstehendeFollowUps,
  getBandMitgliederAnzahlProBand,
  getBands,
  getDashboardStats,
  getGigAnfragenFuerVenues,
  getVenuesWithRelations,
  toPipelineEntries,
} from "@/lib/queries";

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

  const [alleAnfragen, mitgliederProBand] = await Promise.all([
    getGigAnfragenFuerVenues(venues.map((v) => v.id)),
    getBandMitgliederAnzahlProBand(),
  ]);
  const anfragen = alleAnfragen.filter(
    (a) => bandFilter === ALLE_BANDS_PARAM || a.band_id === bandFilter
  );

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

      <BereitZuBuchenBanner entries={bereitZuBuchen} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Veranstalter gesamt" value={stats.gesamtVeranstalter} />
        {stats.proBand.map(({ band, anzahl }) => (
          <StatCard key={band.id} label={band.name} value={anzahl} />
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Status-Verteilung {bandFilter === ALLE_BANDS_PARAM ? "(beide Bands)" : ""}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {stats.statusVerteilung.map(({ status, anzahl }) => (
            <div
              key={status}
              className="rounded-lg border border-slate-200 bg-white p-3 text-center"
            >
              <p className="text-xl font-semibold text-slate-900">{anzahl}</p>
              <p className="text-xs text-slate-500">{STATUS_LABELS[status]}</p>
            </div>
          ))}
          {stats.statusVerteilung.length === 0 && (
            <p className="col-span-full text-sm text-slate-500">
              Noch keine Veranstalter zugeordnet.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">Team-Anfragen</h2>
        <TeamAnfragenList
          anfragen={anfragen}
          venues={venues}
          bands={bands}
          mitgliederProBand={mitgliederProBand}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Anstehende Follow-ups (nächste 7 Tage)
        </h2>
        <FollowUpList entries={followUps} />
      </section>
    </div>
  );
}
