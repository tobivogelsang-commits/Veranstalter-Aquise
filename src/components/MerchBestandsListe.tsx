"use client";

import { useState } from "react";
import clsx from "clsx";
import { setzeMerchBestand } from "@/lib/merchActions";
import type { MerchArtikel } from "@/lib/types";

// Bestandsliste des Merch-Lagers, gruppiert nach Kategorie. Kern beider
// Ansichten: am Desktop mit Bearbeiten/Löschen je Artikel, in der Team-App
// (kompakt) nur mit −/+ zum Abbuchen nach einem Gig.
//
// Der Bestand wird optimistisch gesetzt und sofort gespeichert; mehrere
// schnelle Klicks auf − sind dadurch flüssig (jeder Klick schickt den neuen
// Absolutwert, der letzte gewinnt).

export function istKnapp(artikel: MerchArtikel): boolean {
  return artikel.mindestbestand > 0 && artikel.bestand <= artikel.mindestbestand;
}

export function MerchBestandsListe({
  bandId,
  artikel,
  onBestandGeaendert,
  kompakt = false,
  aufDunkel = false,
  onBearbeiten,
  onLoeschen,
}: {
  bandId: string;
  artikel: MerchArtikel[];
  onBestandGeaendert: (artikelId: string, bestand: number) => void;
  kompakt?: boolean;
  aufDunkel?: boolean;
  onBearbeiten?: (artikel: MerchArtikel) => void;
  onLoeschen?: (artikel: MerchArtikel) => void;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  // Zwischenstand beim Tippen im Bestandsfeld (Inventur): erst beim Verlassen
  // des Feldes bzw. mit Enter wird gespeichert, sonst würde jede Ziffer eine
  // Server-Aktion auslösen ("12" käme als 1, dann 12 an).
  const [entwurf, setEntwurf] = useState<Record<string, string>>({});

  function speichere(a: MerchArtikel, neu: number) {
    if (neu === a.bestand) return;
    setFehler(null);
    onBestandGeaendert(a.id, neu);
    setzeMerchBestand(a.id, bandId, neu).then((ergebnis) => {
      if (!ergebnis.ok) setFehler(ergebnis.fehler);
    });
  }

  function aendere(a: MerchArtikel, delta: number) {
    speichere(a, Math.max(0, a.bestand + delta));
  }

  // Getippte Zahl übernehmen; leere oder unsinnige Eingaben werden verworfen
  // (das Feld springt dann auf den gespeicherten Wert zurück).
  function uebernimm(a: MerchArtikel) {
    const roh = entwurf[a.id];
    setEntwurf((prev) => {
      const next = { ...prev };
      delete next[a.id];
      return next;
    });
    if (roh === undefined || roh.trim() === "") return;
    const zahl = Number(roh);
    if (!Number.isFinite(zahl)) return;
    speichere(a, Math.max(0, Math.trunc(zahl)));
  }

  if (artikel.length === 0) {
    return (
      <p
        className={clsx(
          "text-sm",
          aufDunkel ? "text-slate-200" : "text-slate-500 dark:text-slate-400"
        )}
      >
        Noch keine Artikel im Lager.
      </p>
    );
  }

  // Kategorien in der Reihenfolge ihres ersten Auftretens (die Query sortiert
  // bereits nach Kategorie/Name/Variante).
  const kategorien: string[] = [];
  for (const a of artikel) {
    if (!kategorien.includes(a.kategorie)) kategorien.push(a.kategorie);
  }

  const knopfKlasse = clsx(
    "h-7 w-7 shrink-0 rounded-md border text-sm font-medium leading-none",
    aufDunkel
      ? "border-white/30 text-white hover:bg-white/10"
      : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
  );

  return (
    <div className="flex flex-col gap-3">
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}

      {kategorien.map((kategorie) => (
        <div key={kategorie} className="flex flex-col gap-1">
          <h3
            className={clsx(
              "text-xs font-semibold uppercase tracking-wide",
              aufDunkel ? "text-slate-300" : "text-slate-400 dark:text-slate-500"
            )}
          >
            {kategorie}
          </h3>
          <ul className="flex flex-col">
            {artikel
              .filter((a) => a.kategorie === kategorie)
              .map((a) => (
                <li
                  key={a.id}
                  className={clsx(
                    "flex items-center gap-2 border-t py-1.5 first:border-t-0",
                    aufDunkel ? "border-white/10" : "border-slate-100 dark:border-slate-700"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        "truncate text-sm",
                        aufDunkel ? "text-white" : "text-slate-900 dark:text-slate-100"
                      )}
                    >
                      {a.name}
                      {a.variante && (
                        <span
                          className={clsx(
                            "ml-1.5 rounded px-1.5 py-0.5 text-xs font-medium",
                            aufDunkel
                              ? "bg-white/15 text-slate-100"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          )}
                        >
                          {a.variante}
                        </span>
                      )}
                    </p>
                    {istKnapp(a) && (
                      <p className="text-xs font-medium text-red-500">
                        nachbestellen (min. {a.mindestbestand})
                      </p>
                    )}
                    {!kompakt && !istKnapp(a) && a.mindestbestand > 0 && (
                      <p className="text-xs text-slate-400">min. {a.mindestbestand}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => aendere(a, -1)}
                    className={knopfKlasse}
                    aria-label={`${a.name} ${a.variante} eins weniger`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={entwurf[a.id] ?? String(a.bestand)}
                    onChange={(e) =>
                      setEntwurf((prev) => ({ ...prev, [a.id]: e.target.value }))
                    }
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={() => uebernimm(a)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    aria-label={`Bestand ${a.name} ${a.variante}`}
                    className={clsx(
                      // Spinner ausblenden: auf dem Handy nimmt er nur Platz weg,
                      // gezählt wird per Tastatur oder über −/+.
                      "w-12 shrink-0 rounded-md border bg-transparent px-1 py-0.5 text-center text-sm font-semibold tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                      aufDunkel
                        ? "border-white/20 text-white focus:border-white/60"
                        : "border-slate-200 focus:border-slate-500 dark:border-slate-700",
                      istKnapp(a)
                        ? "text-red-500"
                        : aufDunkel
                          ? "text-white"
                          : "text-slate-900 dark:text-slate-100"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => aendere(a, 1)}
                    className={knopfKlasse}
                    aria-label={`${a.name} ${a.variante} eins mehr`}
                  >
                    +
                  </button>

                  {onBearbeiten && (
                    <button
                      type="button"
                      onClick={() => onBearbeiten(a)}
                      className="shrink-0 text-slate-300 hover:text-slate-600 dark:hover:text-slate-100"
                      title="Artikel bearbeiten"
                    >
                      ✎
                    </button>
                  )}
                  {onLoeschen && (
                    <button
                      type="button"
                      onClick={() => onLoeschen(a)}
                      className="shrink-0 text-slate-300 hover:text-red-600"
                      title="Artikel löschen"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
