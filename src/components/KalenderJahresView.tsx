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
import { ALLE_BANDS_PARAM, TERMIN_TYP_FARBE } from "@/lib/constants";
import {
  gruppiereEintraegeProTag,
  gruppiereProberaumProTag,
  gruppiereTermineProTag,
  gruppiereUrlaubeProTag,
  kalenderPunktFarbe,
  type TerminVorkommen,
} from "@/lib/kalenderHelpers";
import type { KalenderTermin, PipelineEntry, UrlaubMitName } from "@/lib/types";
import type { ProberaumTermin } from "@/lib/proberaumKalender";

const WOCHENTAGE = ["M", "D", "M", "D", "F", "S", "S"];

function parseJahrParam(jahrParam?: string): number {
  if (jahrParam && /^\d{4}$/.test(jahrParam)) return Number(jahrParam);
  return new Date().getFullYear();
}

function jahrLink(jahr: number, bandFilter: string, tabParam?: string) {
  const params = new URLSearchParams();
  params.set("ansicht", "jahr");
  params.set("jahr", String(jahr));
  if (bandFilter !== ALLE_BANDS_PARAM) params.set("band", bandFilter);
  if (tabParam) params.set("tab", tabParam);
  return `?${params.toString()}`;
}

function monatDetailLink(monat: Date, bandFilter: string, tabParam?: string) {
  const params = new URLSearchParams();
  params.set("monat", format(monat, "yyyy-MM"));
  if (bandFilter !== ALLE_BANDS_PARAM) params.set("band", bandFilter);
  if (tabParam) params.set("tab", tabParam);
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
  proberaumProTag,
  termineProTag,
  urlaubeProTag,
  bandFilter,
  tabParam,
}: {
  monat: Date;
  eintraegeProTag: Map<string, PipelineEntry[]>;
  proberaumProTag: Map<string, ProberaumTermin[]>;
  termineProTag: Map<string, TerminVorkommen[]>;
  urlaubeProTag: Map<string, UrlaubMitName[]>;
  bandFilter: string;
  tabParam?: string;
}) {
  const monatsStart = startOfMonth(monat);
  const monatsEnde = endOfMonth(monat);
  const gitterStart = startOfWeek(monatsStart, { weekStartsOn: 1 });
  const gitterEnde = endOfWeek(monatsEnde, { weekStartsOn: 1 });
  const tage = eachDayOfInterval({ start: gitterStart, end: gitterEnde });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <Link
        href={monatDetailLink(monat, bandFilter, tabParam)}
        className="mb-2 block text-sm font-semibold capitalize text-slate-900 hover:underline dark:text-slate-100"
      >
        {format(monat, "MMMM", { locale: de })}
      </Link>
      <div className="grid grid-cols-7 gap-0.5">
        {WOCHENTAGE.map((tag, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-medium text-slate-400 dark:text-slate-500"
          >
            {tag}
          </div>
        ))}
        {tage.map((tag) => {
          const key = format(tag, "yyyy-MM-dd");
          const tagesEintraege = eintraegeProTag.get(key) ?? [];
          const tagesProberaum = proberaumProTag.get(key) ?? [];
          const tagesTermine = termineProTag.get(key) ?? [];
          const tagesUrlaube = urlaubeProTag.get(key) ?? [];
          const imMonat = isSameMonth(tag, monat);
          const farben = eindeutigeFarben(tagesEintraege);
          const terminFarben = Array.from(
            new Set(tagesTermine.map((v) => v.termin.typ))
          ).map((typ) => TERMIN_TYP_FARBE[typ].punkt);

          const titelTeile = [
            ...tagesEintraege.map((e) => `${e.venue.name} (${e.band.name})`),
            ...tagesTermine.map((v) => v.termin.titel),
            ...tagesProberaum.map((t) => t.titel),
            ...tagesUrlaube.map((u) => `Urlaub ${u.name}`),
          ];
          const titel = titelTeile.join(", ");

          const tagesZahl = (
            <span
              className={clsx(
                "flex h-5 w-5 items-center justify-center rounded text-[10px]",
                imMonat ? "text-slate-500 dark:text-slate-400" : "text-slate-300 dark:text-slate-600",
                isToday(tag) && "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
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
              {terminFarben.map((farbe, i) => (
                <span key={`t${i}`} className={clsx("h-1.5 w-1.5 rounded-full", farbe)} />
              ))}
              {tagesProberaum.length > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              )}
              {tagesUrlaube.length > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              )}
            </span>
          );

          return (
            <div key={key} className="flex flex-col items-center gap-0.5 py-0.5">
              {tagesEintraege.length > 0 ||
              tagesProberaum.length > 0 ||
              tagesTermine.length > 0 ||
              tagesUrlaube.length > 0 ? (
                <Link
                  href={monatDetailLink(monat, bandFilter, tabParam)}
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
  tabParam,
  proberaumTermine = [],
  termine = [],
  urlaube = [],
  kompakt = false,
  vorGitter,
}: {
  eintraege: PipelineEntry[];
  jahrParam?: string;
  bandFilter: string;
  tabParam?: string;
  proberaumTermine?: ProberaumTermin[];
  termine?: KalenderTermin[];
  urlaube?: UrlaubMitName[];
  kompakt?: boolean;
  vorGitter?: React.ReactNode;
}) {
  const jahr = parseJahrParam(jahrParam);
  const eintraegeProTag = gruppiereEintraegeProTag(eintraege);
  const proberaumProTag = gruppiereProberaumProTag(proberaumTermine);
  const termineProTag = gruppiereTermineProTag(termine, `${jahr}-01-01`, `${jahr}-12-31`);
  const urlaubeProTag = gruppiereUrlaubeProTag(urlaube, `${jahr}-01-01`, `${jahr}-12-31`);
  const monate = Array.from({ length: 12 }, (_, i) => new Date(jahr, i, 1));

  const navBtnKlasse = kompakt
    ? "rounded-md border border-slate-200 px-2.5 py-1 text-lg font-semibold text-green-600 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
    : "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={jahrLink(jahr - 1, bandFilter, tabParam)}
          aria-label={`${jahr - 1}`}
          className={navBtnKlasse}
        >
          {kompakt ? "←" : `← ${jahr - 1}`}
        </Link>
        <h2
          className={clsx(
            "font-semibold text-slate-900 dark:text-slate-100",
            kompakt ? "text-base" : "text-lg"
          )}
        >
          {jahr}
        </h2>
        <Link
          href={jahrLink(jahr + 1, bandFilter, tabParam)}
          aria-label={`${jahr + 1}`}
          className={navBtnKlasse}
        >
          {kompakt ? "→" : `${jahr + 1} →`}
        </Link>
      </div>

      {vorGitter}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {monate.map((monat) => (
          <MiniMonat
            key={monat.getMonth()}
            monat={monat}
            eintraegeProTag={eintraegeProTag}
            proberaumProTag={proberaumProTag}
            termineProTag={termineProTag}
            urlaubeProTag={urlaubeProTag}
            bandFilter={bandFilter}
            tabParam={tabParam}
          />
        ))}
      </div>
    </div>
  );
}
