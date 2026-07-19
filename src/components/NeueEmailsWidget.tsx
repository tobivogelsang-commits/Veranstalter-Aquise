import Link from "next/link";
import { format } from "date-fns";
import type { EingehendeEmailUebersicht } from "@/lib/queries";

export function NeueEmailsWidget({ emails }: { emails: EingehendeEmailUebersicht[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-medium text-slate-900">Neue E-Mails</h2>
      {emails.length === 0 ? (
        <p className="text-sm text-slate-500">Keine neuen E-Mails.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {emails.map((email) => (
            <li
              key={email.id}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {email.venue ? (
                    <Link href={`/venues/${email.venue.id}`} className="hover:underline">
                      {email.venue.name}
                    </Link>
                  ) : (
                    email.von ?? "Unbekannt"
                  )}
                  <span className="font-normal text-slate-500"> · {email.band.name}</span>
                </p>
                <p className="truncate text-xs text-slate-500">{email.betreff}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {format(new Date(email.zeitpunkt), "dd.MM.yyyy · HH:mm")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
