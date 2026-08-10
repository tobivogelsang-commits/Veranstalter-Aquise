import Link from "next/link";
import clsx from "clsx";
import { BandSwitcher } from "@/components/BandSwitcher";
import { AngebotLoeschenKnopf } from "@/components/AngebotLoeschenKnopf";
import { NeuesAngebotButton } from "@/components/NeuesAngebotButton";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import { berechneAngebotSummen, formatDatumLang, formatEuro } from "@/lib/angebotHelpers";
import { getAngebote, getBands } from "@/lib/queries";
import type { AngebotStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<AngebotStatus, string> = {
  entwurf: "Entwurf",
  versendet: "Versendet",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
};

const STATUS_FARBE: Record<AngebotStatus, string> = {
  entwurf: "bg-slate-100 text-slate-700",
  versendet: "bg-amber-100 text-amber-800",
  angenommen: "bg-green-100 text-green-800",
  abgelehnt: "bg-red-100 text-red-700",
};

export default async function AngebotePage({
  searchParams,
}: {
  searchParams: Promise<{ band?: string }>;
}) {
  const { band } = await searchParams;
  const bandFilter = band ?? ALLE_BANDS_PARAM;

  const [bands, angebote] = await Promise.all([getBands(), getAngebote(bandFilter)]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Angebote</h1>
          <p className="mt-1 text-sm text-slate-500">
            Angebote schreiben, als PDF erzeugen und an Veranstalter senden.
          </p>
          <div className="mt-3">
            <BandSwitcher bands={bands} />
          </div>
        </div>
        <NeuesAngebotButton bands={bands} bandFilter={bandFilter} />
      </div>

      {angebote.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Noch keine Angebote. Leg eins über „+ Neues Angebot“ an – oder direkt
          beim Veranstalter, dann wird die Anschrift übernommen.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nummer</th>
                <th className="px-4 py-2 font-medium">Empfänger</th>
                <th className="px-4 py-2 font-medium">Band</th>
                <th className="px-4 py-2 font-medium">Datum</th>
                <th className="px-4 py-2 font-medium">Betrag</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-2 py-2" aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {angebote.map((a) => {
                const summen = berechneAngebotSummen(a.positionen, a.ust_satz);
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/angebote/${a.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {a.nummer}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.empfaenger_name || "–"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.band.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDatumLang(a.datum)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatEuro(a.ust_satz > 0 ? summen.brutto : summen.netto)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "rounded px-2 py-0.5 text-xs font-medium",
                          STATUS_FARBE[a.status]
                        )}
                      >
                        {STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <AngebotLoeschenKnopf angebotId={a.id} nummer={a.nummer} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
