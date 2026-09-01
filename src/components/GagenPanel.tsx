"use client";

import { useState } from "react";
import {
  setzeAnteilAusgezahlt,
  speichereGagenverteilung,
} from "@/lib/gagenActions";
import { formatEuro } from "@/lib/angebotHelpers";
import type { BandMitgliedOhnePush, GagenAnteil } from "@/lib/types";

// Gagenverteilung einer (bezahlten) Rechnung: Alle Mitglieder sind
// vorausgewählt, der Gesamtbetrag wird gleichmäßig vorverteilt - Anteile
// lassen sich anpassen, Mitglieder abwählen. Bereits ausgezahlte Anteile
// sind fixiert.
export function GagenPanel({
  rechnungId,
  gesamtbetrag,
  mitglieder,
  anteile,
}: {
  rechnungId: string;
  gesamtbetrag: number;
  mitglieder: BandMitgliedOhnePush[];
  anteile: GagenAnteil[];
}) {
  const [gespeicherte, setGespeicherte] = useState<GagenAnteil[]>(anteile);
  const [bearbeiten, setBearbeiten] = useState(anteile.length === 0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  // Entwurfszeilen für den Bearbeiten-Modus.
  const [zeilen, setZeilen] = useState<
    { mitgliedId: string | null; name: string; betrag: number; dabei: boolean }[]
  >(() => starteZeilen());

  function starteZeilen() {
    if (gespeicherte.length > 0) {
      return gespeicherte.map((a) => ({
        mitgliedId: a.mitglied_id,
        name: a.mitglied_name,
        betrag: Number(a.betrag),
        dabei: true,
      }));
    }
    const proKopf =
      mitglieder.length > 0
        ? Math.floor((gesamtbetrag / mitglieder.length) * 100) / 100
        : 0;
    return mitglieder.map((m) => ({
      mitgliedId: m.id,
      name: m.name,
      betrag: proKopf,
      dabei: true,
    }));
  }

  function verteileGleich() {
    setZeilen((prev) => {
      const aktive = prev.filter((z) => z.dabei).length;
      if (aktive === 0) return prev;
      const proKopf = Math.floor((gesamtbetrag / aktive) * 100) / 100;
      return prev.map((z) => (z.dabei ? { ...z, betrag: proKopf } : z));
    });
  }

  const summe = zeilen
    .filter((z) => z.dabei)
    .reduce((s, z) => s + (Number(z.betrag) || 0), 0);
  const rest = Math.round((gesamtbetrag - summe) * 100) / 100;

  const ausgezahlteNamen = new Set(
    gespeicherte.filter((a) => a.ausgezahlt_am).map((a) => a.mitglied_name)
  );

  async function speichern() {
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await speichereGagenverteilung(
      rechnungId,
      zeilen
        .filter((z) => z.dabei)
        .map((z) => ({ mitgliedId: z.mitgliedId, name: z.name, betrag: z.betrag }))
    );
    setLaeuft(false);
    if (!ergebnis.ok) return setFehler(ergebnis.fehler);
    setGespeicherte(ergebnis.anteile);
    setBearbeiten(false);
  }

  async function toggleAusgezahlt(anteil: GagenAnteil) {
    const neu = !anteil.ausgezahlt_am;
    setGespeicherte((prev) =>
      prev.map((a) =>
        a.id === anteil.id
          ? { ...a, ausgezahlt_am: neu ? new Date().toISOString().slice(0, 10) : null }
          : a
      )
    );
    const ergebnis = await setzeAnteilAusgezahlt(anteil.id, neu);
    if (!ergebnis.ok) {
      setGespeicherte((prev) =>
        prev.map((a) => (a.id === anteil.id ? anteil : a))
      );
      setFehler(ergebnis.fehler);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-900">Gagenverteilung</h2>
        {!bearbeiten && (
          <button
            type="button"
            onClick={() => {
              setZeilen(starteZeilen());
              setBearbeiten(true);
            }}
            className="text-xs font-medium text-slate-600 hover:underline"
          >
            {gespeicherte.length > 0 ? "Anpassen" : "Verteilen"}
          </button>
        )}
      </div>

      {bearbeiten ? (
        <div className="flex flex-col gap-2">
          {zeilen.map((zeile, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked={zeile.dabei}
                  disabled={ausgezahlteNamen.has(zeile.name)}
                  onChange={(e) =>
                    setZeilen((prev) =>
                      prev.map((z, x) =>
                        x === i ? { ...z, dabei: e.target.checked } : z
                      )
                    )
                  }
                  className="h-4 w-4 accent-slate-900"
                />
                <span className="truncate">{zeile.name}</span>
                {ausgezahlteNamen.has(zeile.name) && (
                  <span className="text-xs text-green-700">(ausgezahlt, fixiert)</span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                value={zeile.betrag || ""}
                disabled={!zeile.dabei || ausgezahlteNamen.has(zeile.name)}
                onChange={(e) =>
                  setZeilen((prev) =>
                    prev.map((z, x) =>
                      x === i ? { ...z, betrag: Number(e.target.value) } : z
                    )
                  )
                }
                className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          ))}

          <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-sm">
            <button
              type="button"
              onClick={verteileGleich}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Gleichmäßig verteilen
            </button>
            <span className="text-slate-500">
              Verteilt: <strong>{formatEuro(summe)}</strong> von{" "}
              {formatEuro(gesamtbetrag)}
              {rest !== 0 && (
                <span className={rest > 0 ? " text-amber-700" : " text-red-600"}>
                  {" "}
                  ({rest > 0 ? "Rest " : "zu viel "}
                  {formatEuro(Math.abs(rest))})
                </span>
              )}
            </span>
            <div className="ml-auto flex gap-2">
              {gespeicherte.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBearbeiten(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Abbrechen
                </button>
              )}
              <button
                type="button"
                onClick={speichern}
                disabled={laeuft}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Verteilung speichern
              </button>
            </div>
          </div>
        </div>
      ) : gespeicherte.length === 0 ? (
        <p className="text-sm text-slate-400">Noch nicht verteilt.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {gespeicherte.map((anteil) => (
            <li
              key={anteil.id}
              className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm"
            >
              <span>{anteil.mitglied_name}</span>
              <span className="flex items-center gap-3">
                <span className="font-medium">{formatEuro(Number(anteil.betrag))}</span>
                <button
                  type="button"
                  onClick={() => toggleAusgezahlt(anteil)}
                  className={
                    anteil.ausgezahlt_am
                      ? "text-xs font-medium text-green-700 hover:underline"
                      : "text-xs font-medium text-slate-500 hover:underline"
                  }
                  title={
                    anteil.ausgezahlt_am
                      ? "Klick = wieder als offen markieren"
                      : "Klick = als ausgezahlt markieren"
                  }
                >
                  {anteil.ausgezahlt_am
                    ? `✓ ausgezahlt ${new Date(anteil.ausgezahlt_am).toLocaleDateString("de-DE")}`
                    : "offen"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {fehler && <p className="mt-2 text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
