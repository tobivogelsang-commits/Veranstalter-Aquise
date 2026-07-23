"use client";

import { useState } from "react";
import { erstelleUrlaub, loescheUrlaub } from "@/lib/urlaubActions";
import type { UrlaubMitName } from "@/lib/types";

const inputClass =
  "rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

function formatDatum(datum: string): string {
  return datum.split("-").reverse().join(".");
}

// Urlaube eintragen und auflisten. Zwei Betriebsarten:
// - Team-App: eigeneMitglied gesetzt -> Einträge nur für sich selbst,
//   Löschen nur beim eigenen Urlaub (die übrigen sind sichtbar, aber fix).
// - Desktop: mitglieder gesetzt -> der Organizer wählt das Mitglied aus und
//   kann alle Einträge löschen.
export function UrlaubManager({
  bandId,
  initialUrlaube,
  eigeneMitglied,
  mitglieder,
  onChange,
}: {
  bandId: string;
  initialUrlaube: UrlaubMitName[];
  eigeneMitglied?: { id: string; name: string } | null;
  // Desktop: Auswahl über alle sichtbaren Bands - jedes Mitglied bringt seine
  // Band mit, damit die Aktion mit der richtigen Band-ID aufgerufen wird.
  mitglieder?: { id: string; name: string; bandId: string }[];
  onChange?: (urlaube: UrlaubMitName[]) => void;
}) {
  const [urlaube, setUrlaube] = useState<UrlaubMitName[]>(initialUrlaube);
  const [offen, setOffen] = useState(false);
  const [mitgliedId, setMitgliedId] = useState(eigeneMitglied?.id ?? "");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  function aktualisiere(next: UrlaubMitName[]) {
    setUrlaube(next);
    onChange?.(next);
  }

  async function handleEintragen() {
    const zielMitglied = eigeneMitglied?.id ?? mitgliedId;
    const zielBandId = eigeneMitglied
      ? bandId
      : (mitglieder ?? []).find((m) => m.id === mitgliedId)?.bandId;
    if (!zielMitglied || !zielBandId || !von || !bis || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await erstelleUrlaub(zielMitglied, zielBandId, von, bis);
    setLaeuft(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    aktualisiere(
      [...urlaube, ergebnis.urlaub].sort((a, b) => a.von.localeCompare(b.von))
    );
    setVon("");
    setBis("");
  }

  async function handleLoeschen(urlaub: UrlaubMitName) {
    if (!confirm(`Urlaub von ${urlaub.name} (${formatDatum(urlaub.von)} – ${formatDatum(urlaub.bis)}) löschen?`))
      return;
    setFehler(null);
    const ergebnis = await loescheUrlaub(urlaub.id, urlaub.bandId);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    aktualisiere(urlaube.filter((u) => u.id !== urlaub.id));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOffen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Urlaube ({urlaube.length})
        </span>
        <span className="text-xs text-slate-400">{offen ? "einklappen" : "aufklappen"}</span>
      </button>

      {offen && (
        <div className="mt-3 flex flex-col gap-3">
          {urlaube.length > 0 && (
            <ul className="flex flex-col gap-1">
              {urlaube.map((urlaub) => {
                const darfLoeschen = eigeneMitglied
                  ? urlaub.mitgliedId === eigeneMitglied.id
                  : true;
                return (
                  <li key={urlaub.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-slate-900 dark:text-slate-100">
                      {urlaub.name}
                      <span className="text-slate-500 dark:text-slate-400">
                        {" "}
                        · {formatDatum(urlaub.von)} – {formatDatum(urlaub.bis)}
                      </span>
                    </span>
                    {darfLoeschen && (
                      <button
                        type="button"
                        onClick={() => handleLoeschen(urlaub)}
                        className="shrink-0 text-slate-300 hover:text-red-600"
                        title="Urlaub löschen"
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {eigeneMitglied ? (
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {eigeneMitglied.name}:
              </span>
            ) : (
              <select
                value={mitgliedId}
                onChange={(e) => setMitgliedId(e.target.value)}
                className={inputClass}
              >
                <option value="">Mitglied…</option>
                {(mitglieder ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
              className={inputClass}
              aria-label="Urlaub von"
            />
            <span className="text-xs text-slate-400">bis</span>
            <input
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
              className={inputClass}
              aria-label="Urlaub bis"
            />
            <button
              type="button"
              onClick={handleEintragen}
              disabled={laeuft}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              + Urlaub
            </button>
          </div>
          {fehler && <p className="text-xs text-red-600">{fehler}</p>}
        </div>
      )}
    </div>
  );
}
