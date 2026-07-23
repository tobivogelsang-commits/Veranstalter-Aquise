import Link from "next/link";
import clsx from "clsx";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import {
  getBands,
  getKalenderEintraege,
  getProduktionsAuswahl,
  getSetlistenAuswahl,
  getSongKataloge,
  getTermine,
  getTerminSongs,
  getTerminTeilnahme,
  getUrlaube,
  getVenuesWithRelations,
} from "@/lib/queries";
import { kalenderPunktFarbe } from "@/lib/kalenderHelpers";
import { getProberaumTermine } from "@/lib/proberaumKalender";
import { KalenderMonatsView } from "@/components/KalenderMonatsView";
import { KalenderJahresView } from "@/components/KalenderJahresView";
import { BandSwitcher } from "@/components/BandSwitcher";
import { TermineManager } from "@/components/TermineManager";
import { UrlaubManager } from "@/components/UrlaubManager";

export const dynamic = "force-dynamic";

function ansichtLink(ansicht: "monat" | "jahr", bandFilter: string) {
  const params = new URLSearchParams();
  params.set("ansicht", ansicht);
  if (bandFilter !== ALLE_BANDS_PARAM) params.set("band", bandFilter);
  return `?${params.toString()}`;
}

export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<{
    band?: string;
    monat?: string;
    jahr?: string;
    ansicht?: string;
  }>;
}) {
  const { band, monat, jahr, ansicht } = await searchParams;
  const bandFilter = band ?? ALLE_BANDS_PARAM;
  const aktiveAnsicht = ansicht === "jahr" ? "jahr" : "monat";

  const [
    bands,
    venues,
    proberaumTermine,
    termine,
    terminTeilnahme,
    songKataloge,
    produktionsAuswahl,
    setlistenAuswahl,
    terminSongs,
    urlaube,
  ] = await Promise.all([
    getBands(),
    getVenuesWithRelations(),
    getProberaumTermine(),
    getTermine(bandFilter),
    getTerminTeilnahme(bandFilter),
    getSongKataloge(bandFilter),
    getProduktionsAuswahl(bandFilter),
    getSetlistenAuswahl(bandFilter),
    getTerminSongs(bandFilter),
    getUrlaube(bandFilter),
  ]);
  const eintraege = getKalenderEintraege(venues, bandFilter);

  // Mitglieder-Auswahl für den UrlaubManager; bei "alle" Bands den Bandnamen
  // zur Unterscheidung anhängen (Namen können doppelt vorkommen).
  const bandNameById = Object.fromEntries(bands.map((b) => [b.id, b.name]));
  const urlaubMitglieder = Object.entries(terminTeilnahme.mitgliederProBand).flatMap(
    ([bId, mitglieder]) =>
      mitglieder.map((m) => ({
        id: m.id,
        bandId: bId,
        name:
          bandFilter === ALLE_BANDS_PARAM
            ? `${m.name} (${bandNameById[bId] ?? "?"})`
            : m.name,
      }))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Kalender</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gebuchte Gigs und Interessenten im Überblick.
          </p>
          <div className="mt-3">
            <BandSwitcher bands={bands} />
          </div>
        </div>
        <div className="flex rounded-md border border-slate-300 text-sm font-medium">
          <Link
            href={ansichtLink("monat", bandFilter)}
            className={clsx(
              "rounded-l-md px-3 py-1.5",
              aktiveAnsicht === "monat"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Monat
          </Link>
          <Link
            href={ansichtLink("jahr", bandFilter)}
            className={clsx(
              "rounded-r-md border-l border-slate-300 px-3 py-1.5",
              aktiveAnsicht === "jahr"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Jahr
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
        {bands.map((b) => (
          <span key={b.id} className="flex items-center gap-3">
            <span className="font-medium text-slate-700">{b.name}:</span>
            <span className="flex items-center gap-1.5">
              <span
                className={clsx(
                  "inline-block h-3 w-3 rounded-sm",
                  kalenderPunktFarbe(b.name, "gebucht")
                )}
              />
              Gebucht
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={clsx(
                  "inline-block h-3 w-3 rounded-sm",
                  kalenderPunktFarbe(b.name, "interessiert")
                )}
              />
              Interessiert
            </span>
          </span>
        ))}
      </div>

      <TermineManager bands={bands} bandFilter={bandFilter} initialTermine={termine} />

      <UrlaubManager
        bandId={bandFilter}
        initialUrlaube={urlaube}
        mitglieder={urlaubMitglieder}
      />

      {aktiveAnsicht === "jahr" ? (
        <KalenderJahresView
          eintraege={eintraege}
          jahrParam={jahr}
          bandFilter={bandFilter}
          proberaumTermine={proberaumTermine}
          termine={termine}
          urlaube={urlaube}
        />
      ) : (
        <KalenderMonatsView
          eintraege={eintraege}
          monatParam={monat}
          bandFilter={bandFilter}
          proberaumTermine={proberaumTermine}
          termine={termine}
          terminTeilnahme={terminTeilnahme}
          songKataloge={songKataloge}
          produktionsAuswahl={produktionsAuswahl}
          setlistenAuswahl={setlistenAuswahl}
          terminSongs={terminSongs}
          urlaube={urlaube}
        />
      )}
    </div>
  );
}
