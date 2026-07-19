import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type {
  Band,
  BandMitgliedOhnePush,
  GigAnfrageMitAntworten,
  VenueWithRelations,
} from "@/lib/types";

// Anfragen, bei denen noch nicht alle Bandmitglieder geantwortet haben -
// zeigt direkt, wer noch fehlt, statt nur ein "x/y bestätigt"-Verhältnis
// (das übernimmt AnfrageBadge auf der Veranstalter-Seite weiterhin).
export function OffeneTeamAntworten({
  anfragen,
  venues,
  bands,
  mitgliederProBand,
}: {
  anfragen: GigAnfrageMitAntworten[];
  venues: VenueWithRelations[];
  bands: Band[];
  mitgliederProBand: Record<string, BandMitgliedOhnePush[]>;
}) {
  const eintraege = anfragen
    .filter((anfrage) => anfrage.status === "offen")
    .map((anfrage) => {
      const mitglieder = mitgliederProBand[anfrage.band_id] ?? [];
      const geantwortetIds = new Set(anfrage.antworten.map((r) => r.mitglied_id));
      const fehlendeNamen = mitglieder
        .filter((m) => !geantwortetIds.has(m.id))
        .map((m) => m.name);
      return {
        anfrage,
        venue: venues.find((v) => v.id === anfrage.venue_id),
        band: bands.find((b) => b.id === anfrage.band_id),
        fehlendeNamen,
      };
    })
    .filter((eintrag) => eintrag.fehlendeNamen.length > 0);

  if (eintraege.length === 0) {
    return <p className="text-sm text-slate-500">Aktuell keine offenen Team-Antworten.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {eintraege.map(({ anfrage, venue, band, fehlendeNamen }) => (
        <li key={anfrage.id} className="p-4">
          <Link
            href={`/venues/${anfrage.venue_id}`}
            className="font-medium text-slate-900 hover:underline"
          >
            {venue?.name ?? "Unbekannt"}
          </Link>
          <span className="text-sm text-slate-500">
            {" "}
            · {band?.name}
            {venue?.veranstaltungsdatum &&
              ` · ${format(new Date(venue.veranstaltungsdatum), "dd.MM.yyyy", { locale: de })}`}
          </span>
          <p className="mt-1 text-sm text-slate-600">
            Noch keine Antwort: {fehlendeNamen.join(", ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
