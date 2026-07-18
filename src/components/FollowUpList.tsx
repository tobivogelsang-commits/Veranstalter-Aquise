import Link from "next/link";
import clsx from "clsx";
import { format, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { StatusBadge } from "@/components/StatusBadge";
import type { PipelineEntry } from "@/lib/types";

export function FollowUpList({ entries }: { entries: PipelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Keine anstehenden Follow-ups in den nächsten 7 Tagen.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {entries.map((entry) => {
        const datum = new Date(entry.relation.naechster_follow_up_am!);
        const ueberfaellig = isPast(datum) && !isToday(datum);

        return (
          <li key={entry.relation.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <Link
                href={`/venues/${entry.venue.id}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {entry.venue.name}
              </Link>
              <p className="text-sm text-slate-500">{entry.band.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={entry.relation.status} />
              <span
                className={clsx(
                  "text-sm",
                  ueberfaellig ? "font-semibold text-red-600" : "text-slate-600"
                )}
              >
                {ueberfaellig ? "Überfällig: " : ""}
                {format(datum, "dd.MM.yyyy", { locale: de })}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
