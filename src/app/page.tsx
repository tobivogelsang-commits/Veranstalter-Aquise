import Link from "next/link";
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
  getMerchNachbestellProBand,
  getVenuesOhneAngebot,
  getNeuesteEingehendeEmails,
  getNeuesteProtokollEintraege,
  getVenuesWithRelations,
  toPipelineEntries,
} from "@/lib/queries";
import { getMitgliederFuerBand } from "@/lib/teamActions";
import type { BandMitgliedOhnePush } from "@/lib/types";
import { requireFreigabeSeite } from "@/lib/authServer";

// Live-Daten pro Request, keine statische Zwischenspeicherung beim Build.
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ band?: string }>;
}) {
  await requireFreigabeSeite("akquise");
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

  const [
    alleAnfragen,
    mitgliederListen,
    neueEmails,
    aktivitaeten,
    merchProBand,
    offeneAngebote,
  ] =
    await Promise.all([
      getGigAnfragenFuerVenues(venues.map((v) => v.id)),
      Promise.all(bands.map((b) => getMitgliederFuerBand(b.id))),
      getNeuesteEingehendeEmails(bandFilter, 5),
      getNeuesteProtokollEintraege(bandFilter, 5),
      getMerchNachbestellProBand(),
      getVenuesOhneAngebot(bandFilter),
    ]);
  // Betroffene Bands für den Merch-Hinweis. Ist genau eine betroffen, führt
  // der Hinweis direkt in ihr Lager statt auf die Band-Auswahl.
  const merchBetroffen = Object.entries(merchProBand).filter(
    ([bId]) => bandFilter === ALLE_BANDS_PARAM || bId === bandFilter
  );
  const merchNachbestellen = merchBetroffen.reduce((summe, [, n]) => summe + n, 0);
  const merchZiel =
    merchBetroffen.length === 1 ? `/merch/${merchBetroffen[0][0]}` : "/merch";
  const merchBandName =
    merchBetroffen.length === 1
      ? (bands.find((b) => b.id === merchBetroffen[0][0])?.name ?? null)
      : null;

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

      {offeneAngebote.length > 0 && (
        <div className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3">
          <p className="text-sm font-semibold text-sky-900">
            📄 Angebot schreiben ({offeneAngebote.length})
          </p>
          <p className="mt-0.5 text-sm text-sky-800">
            Diese Kontakte stehen auf „Bereit zu buchen“, haben aber noch kein
            Angebot:
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {offeneAngebote.map((o) => (
              <li key={`${o.venueId}-${o.bandId}`}>
                <Link
                  href={`/venues/${o.venueId}`}
                  className="text-sm text-sky-900 underline hover:text-sky-950"
                >
                  {o.venueName}
                </Link>
                <span className="text-sm text-sky-700"> · {o.bandName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {merchNachbestellen > 0 && (
        <Link
          href={merchZiel}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        >
          <span className="font-semibold">
            📦 Merch nachbestellen ({merchNachbestellen})
          </span>{" "}
          – Artikel haben ihren Mindestbestand erreicht
          {merchBandName ? ` (${merchBandName})` : ""}.
        </Link>
      )}

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
