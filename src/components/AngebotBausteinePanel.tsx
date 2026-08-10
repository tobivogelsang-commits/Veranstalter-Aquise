"use client";

import { useState } from "react";
import { loescheBaustein, speichereBaustein } from "@/lib/angebotActions";
import type { AngebotBausteinFeld } from "@/lib/database.types";
import type { AngebotBaustein } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

const FELD_LABEL: Record<AngebotBausteinFeld, string> = {
  einleitung: "Einleitung",
  zahlungsbedingungen: "Zahlungsbedingungen",
  nachbemerkung: "Nachbemerkung",
};

const FELDER: AngebotBausteinFeld[] = [
  "einleitung",
  "zahlungsbedingungen",
  "nachbemerkung",
];

const leer = {
  id: undefined as string | undefined,
  feld: "einleitung" as AngebotBausteinFeld,
  titel: "",
  text: "",
  istStandard: false,
};

// Textbausteine für Angebote: wiederkehrende Formulierungen einmal hinterlegen
// und im Angebot per Auswahl einsetzen. Der als Standard markierte Baustein
// steht bei jedem neuen Angebot automatisch drin.
export function AngebotBausteinePanel({
  bandId,
  initialBausteine,
}: {
  bandId: string;
  initialBausteine: AngebotBaustein[];
}) {
  const [bausteine, setBausteine] = useState<AngebotBaustein[]>(initialBausteine);
  const [form, setForm] = useState(leer);
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function handleSpeichern() {
    if (!form.titel.trim() || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await speichereBaustein(bandId, {
      id: form.id,
      feld: form.feld,
      titel: form.titel,
      text: form.text,
      istStandard: form.istStandard,
    });
    setLaeuft(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    setBausteine((prev) => {
      // Standard ist je Feld eindeutig - alte Markierung lokal mitziehen.
      const bereinigt = form.istStandard
        ? prev.map((b) =>
            b.feld === form.feld ? { ...b, ist_standard: false } : b
          )
        : prev;
      const ohneAlten = bereinigt.filter((b) => b.id !== ergebnis.baustein.id);
      return [...ohneAlten, ergebnis.baustein].sort(
        (a, b) => a.feld.localeCompare(b.feld) || a.titel.localeCompare(b.titel)
      );
    });
    setForm(leer);
  }

  async function handleLoeschen(baustein: AngebotBaustein) {
    if (!confirm(`Baustein „${baustein.titel}“ löschen?`)) return;
    const ergebnis = await loescheBaustein(baustein.id, bandId);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    setBausteine((prev) => prev.filter((b) => b.id !== baustein.id));
    if (form.id === baustein.id) setForm(leer);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setOffen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-medium text-slate-900">
          Textbausteine für Angebote ({bausteine.length})
        </span>
        <span className="text-xs text-slate-400">
          {offen ? "einklappen" : "aufklappen"}
        </span>
      </button>

      {offen && (
        <div className="mt-3 flex flex-col gap-4">
          <p className="text-xs text-slate-500">
            Wiederkehrende Formulierungen einmal hinterlegen. Im Angebot lassen
            sie sich per Auswahl einsetzen; der als Standard markierte Baustein
            steht bei jedem neuen Angebot automatisch drin.
          </p>

          {FELDER.map((feld) => {
            const eigene = bausteine.filter((b) => b.feld === feld);
            if (eigene.length === 0) return null;
            return (
              <div key={feld} className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {FELD_LABEL[feld]}
                </h3>
                <ul className="flex flex-col">
                  {eigene.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-start gap-2 border-t border-slate-100 py-1.5 first:border-t-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {b.titel}
                          {b.ist_standard && (
                            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
                              Standard
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-500">{b.text}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            id: b.id,
                            feld: b.feld,
                            titel: b.titel,
                            text: b.text,
                            istStandard: b.ist_standard,
                          })
                        }
                        className="shrink-0 text-slate-300 hover:text-slate-600"
                        title="Bearbeiten"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoeschen(b)}
                        className="shrink-0 text-slate-300 hover:text-red-600"
                        title="Löschen"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
            <h3 className="text-sm font-medium text-slate-900">
              {form.id ? "Baustein bearbeiten" : "Neuer Baustein"}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Für welches Feld?
                <select
                  value={form.feld}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      feld: e.target.value as AngebotBausteinFeld,
                    }))
                  }
                  className={inputClass}
                >
                  {FELDER.map((f) => (
                    <option key={f} value={f}>
                      {FELD_LABEL[f]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Titel (nur zur Auswahl)
                <input
                  value={form.titel}
                  onChange={(e) => setForm((p) => ({ ...p, titel: e.target.value }))}
                  placeholder="z. B. Stadtfest"
                  className={inputClass}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Text
              <textarea
                value={form.text}
                onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
                rows={3}
                placeholder="Der Text, der ins Angebot eingesetzt wird."
                className={inputClass}
              />
            </label>
            <label className="flex w-fit items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={form.istStandard}
                onChange={(e) =>
                  setForm((p) => ({ ...p, istStandard: e.target.checked }))
                }
                className="h-3.5 w-3.5"
              />
              Standard – steht bei jedem neuen Angebot automatisch drin
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSpeichern}
                disabled={laeuft}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {laeuft ? "Speichert…" : form.id ? "Speichern" : "+ Baustein"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={() => setForm(leer)}
                  className="text-sm text-slate-500 underline hover:text-slate-900"
                >
                  Abbrechen
                </button>
              )}
            </div>
            {fehler && <p className="text-xs text-red-600">{fehler}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
