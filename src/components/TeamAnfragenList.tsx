import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { Band, GigAnfrageMitAntworten, Venue } from "@/lib/types";

export function AnfrageBadge({
  anfrage,
  gesamtMitglieder,
}: {
  anfrage: GigAnfrageMitAntworten;
  gesamtMitglieder: number;
}) {
  if (anfrage.status === "bestaetigt") {
    return (
      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        ✓ Alle bestätigt – bereit für Buchung
      </span>
    );
  }

  if (anfrage.status === "abgesagt") {
    const absagen = anfrage.antworten
      .filter((a) => a.antwort === "kann_nicht")
      .map((a) => a.mitglied.name);
    return (
      <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Absage {absagen.length > 0 ? `von ${absagen.join(", ")}` : ""}
      </span>
    );
  }

  const kannAnzahl = anfrage.antworten.filter((a) => a.antwort === "kann").length;
  return (
    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      {kannAnzahl}/{gesamtMitglieder} bestätigt
    </span>
  );
}

export function TeamAnfragenList({
  anfragen,
  venues,
  bands,
  mitgliederProBand,
}: {
  anfragen: GigAnfrageMitAntworten[];
  venues: Venue[];
  bands: Band[];
  mitgliederProBand: Record<string, number>;
}) {
  if (anfragen.length === 0) {
    return <p className="text-sm text-slate-500">Aktuell keine Team-Anfragen.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {anfragen.map((anfrage) => {
        const venue = venues.find((v) => v.id === anfrage.venue_id);
        const band = bands.find((b) => b.id === anfrage.band_id);

        return (
          <li key={anfrage.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <Link
                href={`/venues/${anfrage.venue_id}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {venue?.name ?? "Unbekannt"}
              </Link>
              <p className="text-sm text-slate-500">{band?.name}</p>
            </div>
            <div className="text-right">
              <AnfrageBadge
                anfrage={anfrage}
                gesamtMitglieder={mitgliederProBand[anfrage.band_id] ?? 0}
              />
              <p className="mt-1 text-xs text-slate-400">
                {format(new Date(anfrage.erstellt_am), "dd.MM.yyyy", { locale: de })}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
