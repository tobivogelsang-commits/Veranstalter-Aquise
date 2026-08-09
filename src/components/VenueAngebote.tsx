"use client";

import Link from "next/link";
import clsx from "clsx";
import { erstelleAngebot } from "@/lib/angebotActions";
import { berechneAngebotSummen, formatDatumLang, formatEuro } from "@/lib/angebotHelpers";
import type { AngebotStatus } from "@/lib/database.types";
import type { AngebotMitBand } from "@/lib/types";

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

// Angebote dieser Band für diesen Veranstalter - inkl. Knopf zum Anlegen
// (Anschrift wird dabei übernommen).
export function VenueAngebote({
  bandId,
  venueId,
  angebote,
}: {
  bandId: string;
  venueId: string;
  angebote: AngebotMitBand[];
}) {
  const eigene = angebote.filter((a) => a.band_id === bandId);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-900">
          Angebote ({eigene.length})
        </h3>
        <button
          type="button"
          onClick={() => erstelleAngebot(bandId, venueId)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          + Angebot erstellen
        </button>
      </div>

      {eigene.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {eigene.map((a) => {
            const summen = berechneAngebotSummen(a.positionen, a.ust_satz);
            return (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Link
                  href={`/angebote/${a.id}`}
                  className="min-w-0 flex-1 truncate text-slate-900 hover:underline"
                >
                  {a.nummer}
                  <span className="text-slate-500">
                    {" "}
                    · {formatDatumLang(a.datum)} ·{" "}
                    {formatEuro(a.ust_satz > 0 ? summen.brutto : summen.netto)}
                  </span>
                </Link>
                {a.pdf_dateiname && (
                  <a
                    href={`/api/angebot/${a.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs text-slate-500 underline hover:text-slate-900"
                    title="PDF ansehen"
                  >
                    PDF
                  </a>
                )}
                <span
                  className={clsx(
                    "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                    STATUS_FARBE[a.status]
                  )}
                >
                  {STATUS_LABEL[a.status]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
