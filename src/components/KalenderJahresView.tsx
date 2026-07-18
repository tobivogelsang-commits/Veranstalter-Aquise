import Link from "next/link";
import clsx from "clsx";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import { gruppiereEintraegeProTag, kalenderPunktFarbe } from "@/lib/kalenderHelpers";
import type { PipelineEntry } from "@/lib/types";

const WOCHENTAGE = ["M", "D", "M", "D", "F", "S", "S"];

function parseJahrParam(jahrParam?: string): number {
  if (jahrParam && /^\d{4}$/.test(jahrParam)) return Number(jahrParam);
  return new Date().getFullYear();
}

function jahrLink(jahr: number, bandFilter: string) {
  const params = new URLSearchParams();
  params.set("ansicht", "jahr");
  params.set("jahr", String(jahr));
  if (bandFilter !== ALLE_BANDS_PARAM) params.set("band", bandFilter);
  return `?${params.toString()}`;
}

function monatDetailLink(monat: Date, bandFilter: string) {
  const params = new URLSearchParams();
  params.set("monat", format(monat, "yyyy-MM"));
  if (bandFilter !== ALLE_BANDS_PARAM) params.set("band", bandFilter);
  return `?${params.toString()}`;
}

// Ein Punkt pro Band+Status-Kombination, die an diesem Tag vorkommt (mehrere
// Einträge derselben Kombination werden zu einem Punkt zusammengefasst -
// bei der kleinen Zellgröße reicht das als Hinweis, Details gibt's im
// Tooltip/der Monatsansicht).
function eindeutigeFarben(eintraege: PipelineEntry[]): string[] {
  const schluessel = new Set(
    eintraege.map((e) => `${e.band.name}||${e.relation.status}`)
  );
  return Array.from(schluessel).map((s) => {
    const [bandName, status] = s.split("||") as [string, "gebucht" | "interessiert"];
    return kalenderPunktFarbe(bandName, status);
  });
}

function MiniMonat({
  monat,
  eintraegeProTag,
  bandFilter,
}: {
  monat: Date;
  eintraegeProTag: Map<string, PipelineEntry[]>;
  bandFilter: string;
}) {
  const monatsStart = startOfMonth(monat);
  const monatsEnde = endOfMonth(monat);
  const gitterStart = startOfWeek(monatsStart, { weekStartsOn: 1 });
  const gitterEnde = endOfWeek(monatsEnde, { weekStartsOn: 1 });
  const tage = eachDayOfInterval({ start: gitterStart, end: gitterEnde });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <Link
        href={monatDetailLink(monat, bandFilter)}
        className="mb-2 block text-sm font-semibold capitalize text-slate-900 hover:underline"
      >
        {format(monat, "MMMM", { locale: de })}
      </Link>
      <div className="grid grid-cols-7 gap-0.5">
        {WOCHENTAGE.map((tag, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-medium text-slate-400"
          >
            {tag}
          </div>
        ))}
        {tage.map((tag) => {
          const key = format(tag, "yyyy-MM-dd");
          const tagesEintraege = eintraegeProTag.get(key) ?? [];
          const imMonat = isSameMonth(tag, monat);
          const farben = eindeutigeFarben(tagesEintraege);

          const titel = tagesEintraege
            .map((e) => `${e.venue.name} (${e.band.name})`)
            .join(", ");

          const tagesZahl = (
            <span
              className={clsx(
                "flex h-5 w-5 items-center justify-center rounded text-[10px]",
                imMonat ? "text-slate-500" : "text-slate-300",
                isToday(tag) && "bg-slate-900 text-white"
              )}
            >
              {format(tag, "d")}
            </span>
          );

          const punkte = (
            <span className="flex h-1.5 items-center gap-0.5">
              {farben.map((farbe, i) => (
                <span key={i} className={clsx("h-1.5 w-1.5 rounded-full", farbe)} />
              ))}
            </span>
          );

          return (
            <div key={key} className="flex flex-col items-center gap-0.5 py-0.5">
              {tagesEintraege.length > 0 ? (
                <Link
                  href={monatDetailLink(monat, bandFilter)}
                  title={titel}
                  className="flex flex-col items-center gap-0.5"
                >
                  {tagesZahl}
                  {punkte}
                </Link>
              ) : (
                <>
                  {tagesZahl}
                  {punkte}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KalenderJahresView({
  eintraege,
  jahrParam,
  bandFilter,
}: {
  eintraege: PipelineEntry[];
  jahrParam?: string;
  bandFilter: string;
}) {
  const jahr = parseJahrParam(jahrParam);
  const eintraegeProTag = gruppiereEintraegeProTag(eintraege);
  const monate = Array.from({ length: 12 }, (_, i) => new Date(jahr, i, 1));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={jahrLink(jahr - 1, bandFilter)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          ← {jahr - 1}
        </Link>
        <h2 className="text-lg font-semibold text-slate-900">{jahr}</h2>
        <Link
          href={jahrLink(jahr + 1, bandFilter)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {jahr + 1} →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {monate.map((monat) => (
          <MiniMonat
            key={monat.getMonth()}
            monat={monat}
            eintraegeProTag={eintraegeProTag}
            bandFilter={bandFilter}
          />
        ))}
      </div>
    </div>
  );
}
