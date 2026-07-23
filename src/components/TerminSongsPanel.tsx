"use client";

import { useState } from "react";
import clsx from "clsx";
import { speichereTerminSongs } from "@/lib/terminActions";
import { formatDauer, summeDauer } from "@/lib/dauer";
import type { BandSong, TerminPlanEintrag } from "@/lib/types";

// "Songs zum Proben" für ein konkretes Proben-Vorkommen: gemischte Liste aus
// Katalog-Songs, Produktionen (unfertige Songs, angezeigt mit Speichername)
// und Setlisten (bewusst nur der Name, nicht die enthaltenen Songs - kompakt).
// Hinzufügen über ein gruppiertes Auswahlfeld, Entfernen per ×; gespeichert
// wird bei jeder Änderung sofort (optimistisch, wie beim Setliste-Builder).
// Genutzt im Proben-Modal des Kalenders (Desktop + Team-App) und auf der
// "Nächste Probe"-Karte im Team-Dashboard - aufDunkel passt die Farben an den
// dunklen Dashboard-Hintergrund an.

type AuswahlOption = { id: string; name: string };

function eintragId(eintrag: TerminPlanEintrag): string {
  return eintrag.typ === "song" ? eintrag.song.id : eintrag.id;
}

function eintragKey(eintrag: TerminPlanEintrag): string {
  return `${eintrag.typ}-${eintragId(eintrag)}`;
}

export function TerminSongsPanel({
  terminId,
  bandId,
  vorkommenDatum,
  katalog,
  produktionen = [],
  setlisten = [],
  initialEintraege,
  onChange,
  aufDunkel = false,
}: {
  terminId: string;
  bandId: string;
  vorkommenDatum: string;
  katalog: BandSong[];
  produktionen?: AuswahlOption[];
  setlisten?: AuswahlOption[];
  initialEintraege: TerminPlanEintrag[];
  onChange?: (eintraege: TerminPlanEintrag[]) => void;
  aufDunkel?: boolean;
}) {
  const [eintraege, setEintraege] = useState<TerminPlanEintrag[]>(initialEintraege);
  const [fehler, setFehler] = useState<string | null>(null);

  const gewaehlt = new Set(eintraege.map(eintragKey));
  const songAuswahl = katalog.filter((s) => !gewaehlt.has(`song-${s.id}`));
  const produktionsAuswahl = produktionen.filter((p) => !gewaehlt.has(`produktion-${p.id}`));
  const setlistenAuswahl = setlisten.filter((s) => !gewaehlt.has(`setliste-${s.id}`));
  const auswahlLeer =
    songAuswahl.length === 0 && produktionsAuswahl.length === 0 && setlistenAuswahl.length === 0;

  // Gesamtdauer nur über Katalog-Songs - Produktionen haben keine Dauer und
  // Setlisten werden bewusst nur mit Namen angezeigt.
  const gesamt = summeDauer(
    eintraege.map((e) => (e.typ === "song" ? e.song.dauer_sekunden : null))
  );

  function speichern(next: TerminPlanEintrag[]) {
    setEintraege(next);
    onChange?.(next);
    speichereTerminSongs(
      terminId,
      bandId,
      vorkommenDatum,
      next.map((e) => ({ typ: e.typ, id: eintragId(e) }))
    ).then((ergebnis) => {
      if (!ergebnis.ok) setFehler(ergebnis.fehler);
    });
  }

  function handleHinzufuegen(wert: string) {
    // Wert aus dem Select: `${typ}:${id}`.
    const [typ, id] = wert.split(":");
    let neu: TerminPlanEintrag | null = null;
    if (typ === "song") {
      const song = katalog.find((s) => s.id === id);
      if (song) neu = { typ: "song", song };
    } else if (typ === "produktion") {
      const produktion = produktionen.find((p) => p.id === id);
      if (produktion) neu = { typ: "produktion", id: produktion.id, name: produktion.name };
    } else if (typ === "setliste") {
      const setliste = setlisten.find((s) => s.id === id);
      if (setliste) neu = { typ: "setliste", id: setliste.id, name: setliste.name };
    }
    if (!neu || gewaehlt.has(eintragKey(neu))) return;
    setFehler(null);
    speichern([...eintraege, neu]);
  }

  function handleEntfernen(key: string) {
    setFehler(null);
    speichern(eintraege.filter((e) => eintragKey(e) !== key));
  }

  function badgeClass(): string {
    return clsx(
      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
      aufDunkel
        ? "bg-white/15 text-slate-200"
        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className={clsx(
            "text-xs font-medium",
            aufDunkel ? "text-slate-200" : "text-slate-500 dark:text-slate-400"
          )}
        >
          Songs zum Proben
        </span>
        {gesamt > 0 && (
          <span className={clsx("text-xs", aufDunkel ? "text-slate-300" : "text-slate-400")}>
            {formatDauer(gesamt)}
          </span>
        )}
      </div>

      {eintraege.length > 0 && (
        <ul className="flex flex-col">
          {eintraege.map((eintrag, index) => (
            <li key={eintragKey(eintrag)} className="flex items-center gap-2 py-0.5">
              <span className={clsx("w-4 shrink-0 text-xs", aufDunkel ? "text-slate-300" : "text-slate-400")}>
                {index + 1}
              </span>
              <span
                className={clsx(
                  "min-w-0 flex-1 truncate text-sm",
                  aufDunkel ? "text-white" : "text-slate-900 dark:text-slate-100"
                )}
              >
                {eintrag.typ === "song" ? (
                  <>
                    {eintrag.song.titel}
                    {eintrag.song.interpret && (
                      <span className={clsx(aufDunkel ? "text-slate-300" : "text-slate-500 dark:text-slate-400")}>
                        {" "}
                        · {eintrag.song.interpret}
                      </span>
                    )}
                  </>
                ) : (
                  eintrag.name.trim() || "Ohne Titel"
                )}
              </span>
              {eintrag.typ === "produktion" && <span className={badgeClass()}>Prod.</span>}
              {eintrag.typ === "setliste" && <span className={badgeClass()}>Setliste</span>}
              {eintrag.typ === "song" && (
                <span className={clsx("shrink-0 text-xs", aufDunkel ? "text-slate-300" : "text-slate-400")}>
                  {formatDauer(eintrag.song.dauer_sekunden)}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleEntfernen(eintragKey(eintrag))}
                className={clsx(
                  "shrink-0",
                  aufDunkel
                    ? "text-slate-300 hover:text-red-400"
                    : "text-slate-300 hover:text-red-600"
                )}
                title="Eintrag entfernen"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {!auswahlLeer ? (
        <select
          value=""
          onChange={(e) => e.target.value && handleHinzufuegen(e.target.value)}
          className={clsx(
            "w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none",
            aufDunkel
              ? "border-white/30 bg-transparent text-white focus:border-white/60 [&>optgroup]:text-slate-900 [&>optgroup>option]:text-slate-900"
              : "border-slate-300 bg-white text-slate-700 focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          )}
        >
          <option value="">+ Song, Produktion oder Setliste…</option>
          {songAuswahl.length > 0 && (
            <optgroup label="Songs">
              {songAuswahl.map((song) => (
                <option key={song.id} value={`song:${song.id}`}>
                  {song.titel}
                  {song.interpret ? ` · ${song.interpret}` : ""}
                </option>
              ))}
            </optgroup>
          )}
          {produktionsAuswahl.length > 0 && (
            <optgroup label="Produktionen">
              {produktionsAuswahl.map((produktion) => (
                <option key={produktion.id} value={`produktion:${produktion.id}`}>
                  {produktion.name.trim() || "Ohne Titel"}
                </option>
              ))}
            </optgroup>
          )}
          {setlistenAuswahl.length > 0 && (
            <optgroup label="Setlisten">
              {setlistenAuswahl.map((setliste) => (
                <option key={setliste.id} value={`setliste:${setliste.id}`}>
                  {setliste.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      ) : (
        eintraege.length === 0 && (
          <p className={clsx("text-xs", aufDunkel ? "text-slate-300" : "text-slate-500 dark:text-slate-400")}>
            Nichts zum Auswählen - Songs im Setliste-Tab, Produktionen im Prod.-Tab anlegen.
          </p>
        )
      )}
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
    </div>
  );
}
