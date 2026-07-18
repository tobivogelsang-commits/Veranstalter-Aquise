import Link from "next/link";
import type { PipelineEntry } from "@/lib/types";

// Bewusst kräftig/auffällig gestaltet (dicker grüner Rand, Häkchen-Icon) statt
// im sonstigen dezenten Dashboard-Stil - das Team hat zugesagt, Buchen ist die
// einzige noch offene, nicht automatisierbare Aufgabe und soll deshalb sofort
// ins Auge fallen.
export function BereitZuBuchenBanner({ entries }: { entries: PipelineEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-emerald-600 bg-emerald-50 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">✅</span>
        <h2 className="text-base font-semibold text-emerald-900">
          Bereit zu buchen ({entries.length})
        </h2>
      </div>
      <p className="mt-1 text-sm text-emerald-800">
        Das ganze Team hat zugesagt — diese Kontakte warten nur noch auf die Buchung.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.relation.id}>
            <Link
              href={`/venues/${entry.venue.id}`}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-sm hover:bg-emerald-100"
            >
              <span className="font-medium text-slate-900">{entry.venue.name}</span>
              <span className="text-xs text-slate-500">{entry.band.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
