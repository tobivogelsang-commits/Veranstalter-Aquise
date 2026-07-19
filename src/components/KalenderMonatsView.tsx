import Link from "next/link";
import clsx from "clsx";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import { gruppiereEintraegeProTag, gruppiereProberaumProTag, kalenderPillFarbe } from "@/lib/kalenderHelpers";
import type { PipelineEntry } from "@/lib/types";
import type { ProberaumTermin } from "@/lib/proberaumKalender";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function parseMonatParam(monatParam?: string): Date {
  if (monatParam && /^\d{4}-\d{2}$/.test(monatParam)) {
    const [jahr, monatNr] = monatParam.split("-").map(Number);
    return new Date(jahr, monatNr - 1, 1);
  }
  const heute = new Date();
  return new Date(heute.getFullYear(), heute.getMonth(), 1);
}

function monatLink(monat: Date, bandFilter: string, tabParam?: string) {
  const params = new URLSearchParams();
  params.set("monat", format(monat, "yyyy-MM"));
  if (bandFilter !== ALLE_BANDS_PARAM) params.set("band", bandFilter);
  if (tabParam) params.set("tab", tabParam);
  return `?${params.toString()}`;
}

export function KalenderMonatsView({
  eintraege,
  monatParam,
  bandFilter,
  tabParam,
  zeigeBandName,
  venueLinkErlaubt = true,
  proberaumTermine = [],
}: {
  eintraege: PipelineEntry[];
  monatParam?: string;
  bandFilter: string;
  tabParam?: string;
  zeigeBandName?: boolean;
  venueLinkErlaubt?: boolean;
  proberaumTermine?: ProberaumTermin[];
}) {
  const monat = parseMonatParam(monatParam);
  const monatsStart = startOfMonth(monat);
  const monatsEnde = endOfMonth(monat);
  const gitterStart = startOfWeek(monatsStart, { weekStartsOn: 1 });
  const gitterEnde = endOfWeek(monatsEnde, { weekStartsOn: 1 });
  const tage = eachDayOfInterval({ start: gitterStart, end: gitterEnde });

  const zeigeBand = zeigeBandName ?? bandFilter === ALLE_BANDS_PARAM;
  const eintraegeProTag = gruppiereEintraegeProTag(eintraege);
  const proberaumProTag = gruppiereProberaumProTag(proberaumTermine);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={monatLink(subMonths(monat, 1), bandFilter, tabParam)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          ← Vorheriger Monat
        </Link>
        <h2 className="text-lg font-semibold capitalize text-slate-900">
          {format(monat, "MMMM yyyy", { locale: de })}
        </h2>
        <Link
          href={monatLink(addMonths(monat, 1), bandFilter, tabParam)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Nächster Monat →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-xs">
        {WOCHENTAGE.map((tag) => (
          <div
            key={tag}
            className="bg-slate-50 px-2 py-1.5 text-center font-medium text-slate-500"
          >
            {tag}
          </div>
        ))}
        {tage.map((tag) => {
          const key = format(tag, "yyyy-MM-dd");
          const tagesEintraege = eintraegeProTag.get(key) ?? [];
          const tagesProberaum = proberaumProTag.get(key) ?? [];
          const imMonat = isSameMonth(tag, monat);

          return (
            <div
              key={key}
              className={clsx("min-h-[96px] bg-white p-1.5", !imMonat && "bg-slate-50")}
            >
              <div
                className={clsx(
                  "mb-1 text-right text-xs",
                  imMonat ? "text-slate-500" : "text-slate-300"
                )}
              >
                <span
                  className={clsx(
                    "inline-block rounded px-1",
                    isToday(tag) && "bg-slate-900 text-white"
                  )}
                >
                  {format(tag, "d")}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {tagesEintraege.map((eintrag) => {
                  const titel = zeigeBand
                    ? `${eintrag.venue.name} (${eintrag.band.name})`
                    : eintrag.venue.name;
                  const klassen = clsx(
                    "block truncate rounded px-1.5 py-0.5 text-xs font-medium",
                    kalenderPillFarbe(
                      eintrag.band.name,
                      eintrag.relation.status as "gebucht" | "interessiert"
                    )
                  );
                  const inhalt = (
                    <>
                      {eintrag.venue.name}
                      {zeigeBand ? ` · ${eintrag.band.name}` : ""}
                    </>
                  );
                  return venueLinkErlaubt ? (
                    <Link
                      key={eintrag.relation.id}
                      href={`/venues/${eintrag.venue.id}`}
                      title={titel}
                      className={klassen}
                    >
                      {inhalt}
                    </Link>
                  ) : (
                    <span key={eintrag.relation.id} title={titel} className={klassen}>
                      {inhalt}
                    </span>
                  );
                })}
                {tagesProberaum.length > 0 && (
                  <span
                    title={tagesProberaum.map((t) => t.titel).join(", ")}
                    className="block truncate rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600"
                  >
                    Proberaum belegt
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
