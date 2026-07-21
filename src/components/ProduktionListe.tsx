"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import {
  aktualisiereProduktion,
  erstelleProduktion,
  loescheProduktion,
} from "@/lib/produktionActions";
import { PRODUKTION_RECORDINGS, PRODUKTION_STEPS } from "@/lib/constants";
import type { Produktion } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

// Aktiver Chip = Akzentfarbe (gefüllt), inaktiv = neutraler Umriss. Gleiche
// Optik für Einfach- (step) und Mehrfachauswahl (recordings).
function chipClass(aktiv: boolean): string {
  return clsx(
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
    aktiv
      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
      : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
  );
}

function ChevronIcon({ offen }: { offen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx("h-4 w-4 shrink-0 transition-transform", offen && "rotate-180")}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ProduktionKarte({
  produktion,
  offen,
  onToggle,
  onChange,
  onLoeschen,
}: {
  produktion: Produktion;
  offen: boolean;
  onToggle: () => void;
  onChange: (werte: Partial<Produktion>) => void;
  onLoeschen: () => void;
}) {
  const titel = produktion.name.trim() || "Ohne Titel";
  const recordingsText = produktion.recordings.join(" · ");

  function toggleRecording(recording: string) {
    const aktiv = produktion.recordings.includes(recording);
    const next = aktiv
      ? produktion.recordings.filter((r) => r !== recording)
      : [...produktion.recordings, recording];
    onChange({ recordings: next });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={offen}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <ChevronIcon offen={offen} />
          <div className="min-w-0 flex-1">
            <p
              className={clsx(
                "truncate text-sm font-medium",
                produktion.name.trim()
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-400 dark:text-slate-500"
              )}
            >
              {titel}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {produktion.datum.trim() && <span>{produktion.datum}</span>}
              {produktion.step && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {produktion.step}
                </span>
              )}
              {recordingsText && <span>{recordingsText}</span>}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={onLoeschen}
          className="shrink-0 rounded p-1 text-slate-300 hover:text-red-600 dark:text-slate-500"
          title="Eintrag löschen"
          aria-label="Eintrag löschen"
        >
          ✕
        </button>
      </div>

      {offen && (
        <div className="flex flex-col gap-4 border-t border-slate-100 p-3 dark:border-slate-700">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Speichername
            </label>
            <input
              value={produktion.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="z. B. Song-Idee Nr. 3"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Datum
            </label>
            <input
              value={produktion.datum}
              onChange={(e) => onChange({ datum: e.target.value })}
              placeholder="z. B. 15.07. oder nächste Woche"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Prozessschritt
            </span>
            <div className="flex flex-wrap gap-2">
              {PRODUKTION_STEPS.map((step) => {
                const aktiv = produktion.step === step;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => onChange({ step: aktiv ? null : step })}
                    className={chipClass(aktiv)}
                  >
                    {step}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Aufnahmen
            </span>
            <div className="flex flex-wrap gap-2">
              {PRODUKTION_RECORDINGS.map((recording) => (
                <button
                  key={recording}
                  type="button"
                  onClick={() => toggleRecording(recording)}
                  className={chipClass(produktion.recordings.includes(recording))}
                >
                  {recording}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProduktionListe({
  bandId,
  initialProduktionen,
}: {
  bandId: string;
  initialProduktionen: Produktion[];
}) {
  const [produktionen, setProduktionen] = useState<Produktion[]>(initialProduktionen);
  const [offeneIds, setOffeneIds] = useState<Set<string>>(new Set());
  const [fehler, setFehler] = useState<string | null>(null);
  // Debounce-Timer pro Eintrag, damit Tippen im Namens-/Datumsfeld nicht bei
  // jedem Tastendruck eine Server-Action auslöst.
  const speicherTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function speicherePlanen(produktion: Produktion) {
    const bestehend = speicherTimer.current[produktion.id];
    if (bestehend) clearTimeout(bestehend);
    speicherTimer.current[produktion.id] = setTimeout(() => {
      aktualisiereProduktion(produktion.id, bandId, {
        name: produktion.name,
        datum: produktion.datum,
        step: produktion.step,
        recordings: produktion.recordings,
      }).catch((err) => console.error("Produktion speichern fehlgeschlagen", err));
    }, 500);
  }

  function handleChange(produktionId: string, werte: Partial<Produktion>) {
    setProduktionen((prev) => {
      const next = prev.map((p) => (p.id === produktionId ? { ...p, ...werte } : p));
      const aktualisiert = next.find((p) => p.id === produktionId);
      if (aktualisiert) speicherePlanen(aktualisiert);
      return next;
    });
  }

  function toggleOffen(produktionId: string) {
    setOffeneIds((prev) => {
      const next = new Set(prev);
      if (next.has(produktionId)) next.delete(produktionId);
      else next.add(produktionId);
      return next;
    });
  }

  async function handleNeu() {
    setFehler(null);
    const ergebnis = await erstelleProduktion(bandId);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    // Neuester Eintrag oben, direkt aufgeklappt.
    setProduktionen((prev) => [ergebnis.produktion, ...prev]);
    setOffeneIds((prev) => new Set(prev).add(ergebnis.produktion.id));
  }

  async function handleLoeschen(produktionId: string) {
    if (!confirm("Eintrag wirklich löschen?")) return;
    const timer = speicherTimer.current[produktionId];
    if (timer) clearTimeout(timer);
    setProduktionen((prev) => prev.filter((p) => p.id !== produktionId));
    setOffeneIds((prev) => {
      const next = new Set(prev);
      next.delete(produktionId);
      return next;
    });
    await loescheProduktion(produktionId, bandId);
  }

  return (
    <div className="flex flex-col gap-3">
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}

      {produktionen.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Noch keine Produktions-Einträge.
        </p>
      ) : (
        produktionen.map((produktion) => (
          <ProduktionKarte
            key={produktion.id}
            produktion={produktion}
            offen={offeneIds.has(produktion.id)}
            onToggle={() => toggleOffen(produktion.id)}
            onChange={(werte) => handleChange(produktion.id, werte)}
            onLoeschen={() => handleLoeschen(produktion.id)}
          />
        ))
      )}

      <button
        type="button"
        onClick={handleNeu}
        className="self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        + Neuer Eintrag
      </button>
    </div>
  );
}
