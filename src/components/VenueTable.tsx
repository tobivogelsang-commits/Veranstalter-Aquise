"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { StatusBadge } from "@/components/StatusBadge";
import { deleteVenue } from "@/lib/actions";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import type { VenueWithRelations } from "@/lib/types";

function PapierkorbIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

export function VenueTable({
  venues,
  bandFilter,
}: {
  venues: VenueWithRelations[];
  bandFilter: string;
}) {
  const router = useRouter();
  // IDs, deren Löschung gerade läuft bzw. schon durch ist - die Zeile wird
  // sofort ausgeblendet (optimistisch), bis der Server-Refresh sie entfernt.
  const [geloeschteIds, setGeloeschteIds] = useState<Set<string>>(new Set());

  async function handleLoeschen(venue: VenueWithRelations) {
    if (
      !confirm(
        `"${venue.name}" wirklich unwiderruflich löschen? Das kann nicht rückgängig gemacht werden.`
      )
    )
      return;
    setGeloeschteIds((prev) => new Set(prev).add(venue.id));
    try {
      // Ohne Redirect: Wir sind schon auf der Liste, Filter/Suche bleiben
      // erhalten; der refresh() holt die Liste ohne die gelöschte Zeile.
      await deleteVenue(venue.id, false);
      router.refresh();
    } catch (err) {
      console.error("Veranstalter löschen fehlgeschlagen", err);
      setGeloeschteIds((prev) => {
        const next = new Set(prev);
        next.delete(venue.id);
        return next;
      });
      alert("Löschen fehlgeschlagen. Bitte nochmal versuchen.");
    }
  }

  if (venues.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Keine Veranstalter gefunden.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-2" aria-label="Aktionen" />
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Typ</th>
            <th className="px-4 py-2 font-medium">Ort</th>
            <th className="px-4 py-2 font-medium">Termin</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Letzter Kontakt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {venues
            .filter((venue) => !geloeschteIds.has(venue.id))
            .map((venue) => {
            const relationen =
              bandFilter === ALLE_BANDS_PARAM
                ? venue.venue_band_status
                : venue.venue_band_status.filter(
                    (r) => r.band_id === bandFilter
                  );

            return (
              <tr
                key={venue.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => router.push(`/venues/${venue.id}`)}
              >
                <td className="px-2 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      // Nicht die Zeilen-Navigation zur Detailseite auslösen.
                      e.stopPropagation();
                      handleLoeschen(venue);
                    }}
                    className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"
                    title={`"${venue.name}" löschen`}
                    aria-label={`${venue.name} löschen`}
                  >
                    <PapierkorbIcon />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/venues/${venue.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {venue.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{venue.typ ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{venue.ort ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {venue.veranstaltungsdatum
                    ? venue.veranstaltungsdatum.split("-").reverse().join(".")
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  {relationen.length === 0 ? (
                    <span className="text-slate-400">-</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {relationen.map((r) => (
                        <div key={r.id} className="flex items-center gap-2">
                          <StatusBadge status={r.status} />
                          {bandFilter === ALLE_BANDS_PARAM && (
                            <span className="text-xs text-slate-400">
                              {r.band.name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {relationen.length === 0 ? (
                    "-"
                  ) : (
                    <div className="flex flex-col gap-1">
                      {relationen.map((r) => (
                        <div key={r.id}>
                          {r.letzter_kontakt_am
                            ? format(new Date(r.letzter_kontakt_am), "dd.MM.yyyy", {
                                locale: de,
                              })
                            : "-"}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
