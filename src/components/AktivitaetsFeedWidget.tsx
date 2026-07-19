import Link from "next/link";
import { format } from "date-fns";
import { TYP_LABELS } from "@/lib/protokollTypen";
import type { ProtokollUebersicht } from "@/lib/queries";

export function AktivitaetsFeedWidget({ eintraege }: { eintraege: ProtokollUebersicht[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-medium text-slate-900">Aktivitäts-Feed</h2>
      {eintraege.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Aktivität.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {eintraege.map((eintrag) => (
            <li
              key={eintrag.id}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <p className="truncate text-sm text-slate-700">
                <Link
                  href={`/venues/${eintrag.venue.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {eintrag.venue.name}
                </Link>{" "}
                · {TYP_LABELS[eintrag.typ] ?? eintrag.typ}
              </p>
              <span className="shrink-0 text-xs text-slate-400">
                {format(new Date(eintrag.erstellt_am), "dd.MM.yyyy · HH:mm")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
