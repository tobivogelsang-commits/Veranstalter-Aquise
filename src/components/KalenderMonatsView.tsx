"use client";

import { useState } from "react";
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
import { ALLE_BANDS_PARAM, TERMIN_TYP_FARBE, TERMIN_TYP_LABEL } from "@/lib/constants";
import {
  gruppiereEintraegeProTag,
  gruppiereProberaumProTag,
  gruppiereTermineProTag,
  kalenderPillFarbe,
  type TerminVorkommen,
} from "@/lib/kalenderHelpers";
import type { KalenderTermin, PipelineEntry } from "@/lib/types";
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

function formatDatum(datum: string): string {
  return datum.split("-").reverse().join(".");
}

export function KalenderMonatsView({
  eintraege,
  monatParam,
  bandFilter,
  tabParam,
  zeigeBandName,
  venueLinkErlaubt = true,
  proberaumTermine = [],
  termine = [],
  kompakt = false,
  vorGitter,
}: {
  eintraege: PipelineEntry[];
  monatParam?: string;
  bandFilter: string;
  tabParam?: string;
  zeigeBandName?: boolean;
  venueLinkErlaubt?: boolean;
  proberaumTermine?: ProberaumTermin[];
  termine?: KalenderTermin[];
  kompakt?: boolean;
  vorGitter?: React.ReactNode;
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
  const termineProTag = gruppiereTermineProTag(
    termine,
    format(gitterStart, "yyyy-MM-dd"),
    format(gitterEnde, "yyyy-MM-dd")
  );
  const [offeneProberaumTermine, setOffeneProberaumTermine] = useState<ProberaumTermin[] | null>(
    null
  );
  const [offenerTermin, setOffenerTermin] = useState<TerminVorkommen | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {kompakt ? (
        <div className="flex items-center justify-between">
          <Link
            href={monatLink(subMonths(monat, 1), bandFilter, tabParam)}
            aria-label="Vorheriger Monat"
            className="rounded-md border border-slate-200 px-2.5 py-1 text-lg font-semibold text-green-600 hover:bg-slate-100"
          >
            ←
          </Link>
          <h2 className="text-base font-semibold capitalize text-slate-900">
            {format(monat, "MMMM yyyy", { locale: de })}
          </h2>
          <Link
            href={monatLink(addMonths(monat, 1), bandFilter, tabParam)}
            aria-label="Nächster Monat"
            className="rounded-md border border-slate-200 px-2.5 py-1 text-lg font-semibold text-green-600 hover:bg-slate-100"
          >
            →
          </Link>
        </div>
      ) : (
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
      )}

      {vorGitter}

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
          const tagesTermine = termineProTag.get(key) ?? [];
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
                {tagesTermine.map((vorkommen) => (
                  <button
                    key={`${vorkommen.termin.id}-${vorkommen.datum}`}
                    type="button"
                    onClick={() => setOffenerTermin(vorkommen)}
                    title={`${TERMIN_TYP_LABEL[vorkommen.termin.typ]}: ${vorkommen.termin.titel}`}
                    className={clsx(
                      "block w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium",
                      TERMIN_TYP_FARBE[vorkommen.termin.typ].pill
                    )}
                  >
                    {vorkommen.termin.titel}
                  </button>
                ))}
                {tagesProberaum.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOffeneProberaumTermine(tagesProberaum)}
                    className="block w-full truncate rounded bg-slate-200 px-1.5 py-0.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-300"
                  >
                    Proberaum belegt
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {offeneProberaumTermine && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOffeneProberaumTermine(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Proberaum belegt</h3>
              <button
                type="button"
                onClick={() => setOffeneProberaumTermine(null)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
            <ul className="flex flex-col gap-3">
              {offeneProberaumTermine.map((termin) => (
                <li key={termin.id} className="text-sm">
                  <p className="font-medium text-slate-900">{termin.titel}</p>
                  <p className="text-xs text-slate-500">
                    Ab {formatDatum(termin.datum)}
                    {termin.datumBis !== termin.datum &&
                      ` bis ${formatDatum(termin.datumBis)}`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {offenerTermin && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOffenerTermin(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <span
                className={clsx(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  TERMIN_TYP_FARBE[offenerTermin.termin.typ].pill
                )}
              >
                {TERMIN_TYP_LABEL[offenerTermin.termin.typ]}
              </span>
              <button
                type="button"
                onClick={() => setOffenerTermin(null)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
            <p className="text-sm font-medium text-slate-900">{offenerTermin.termin.titel}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDatum(offenerTermin.datum)}
              {offenerTermin.datumBis &&
                offenerTermin.datumBis !== offenerTermin.datum &&
                ` bis ${formatDatum(offenerTermin.datumBis)}`}
              {offenerTermin.termin.uhrzeit
                ? ` · ${offenerTermin.termin.uhrzeit.slice(0, 5)} Uhr`
                : ""}
              {offenerTermin.termin.ort ? ` · ${offenerTermin.termin.ort}` : ""}
            </p>
            {offenerTermin.termin.notiz && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {offenerTermin.termin.notiz}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
