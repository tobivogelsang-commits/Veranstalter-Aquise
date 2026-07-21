"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import {
  aktualisiereProduktion,
  erstelleProduktion,
  loescheProduktion,
} from "@/lib/produktionActions";
import { fuegeSongHinzu } from "@/lib/setlistActions";
import { formatDauer, parseDauerEingabe } from "@/lib/dauer";
import { sucheSongVorschlaege, type SongVorschlag } from "@/lib/musikSuche";
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
  bandId,
  produktion,
  offen,
  onToggle,
  onChange,
  onLoeschen,
}: {
  bandId: string;
  produktion: Produktion;
  offen: boolean;
  onToggle: () => void;
  onChange: (werte: Partial<Produktion>) => void;
  onLoeschen: () => void;
}) {
  const titel = produktion.name.trim() || "Ohne Titel";
  const recordingsText = produktion.recordings.join(" · ");

  // Eigener Formular-State pro Karte, um einen fertigen Song in den Band-Katalog
  // ("Songs" im Setliste-Tab) zu übernehmen - nutzt dieselbe Action wie dort.
  const [songForm, setSongForm] = useState({ titel: "", interpret: "", dauer: "" });
  const [songFehler, setSongFehler] = useState<string | null>(null);
  const [songGespeichert, setSongGespeichert] = useState<string | null>(null);
  const [songLaeuft, setSongLaeuft] = useState(false);

  // Auto-Vervollständigung: Vorschläge aus der iTunes-Suche beim Tippen des
  // Titels. Interpret + Originallänge werden per Klick übernommen.
  const [vorschlaege, setVorschlaege] = useState<SongVorschlag[]>([]);
  const [zeigeVorschlaege, setZeigeVorschlaege] = useState(false);
  const suchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nur das Ergebnis der zuletzt abgeschickten Suche anzeigen (Race vermeiden,
  // wenn eine frühere, langsamere Antwort nach einer neueren eintrifft).
  const suchLaufId = useRef(0);

  function handleTitelChange(wert: string) {
    setSongForm((prev) => ({ ...prev, titel: wert }));
    if (suchTimer.current) clearTimeout(suchTimer.current);
    const suchbegriff = wert.trim();
    if (suchbegriff.length < 2) {
      setVorschlaege([]);
      setZeigeVorschlaege(false);
      return;
    }
    suchTimer.current = setTimeout(async () => {
      const laufId = ++suchLaufId.current;
      const treffer = await sucheSongVorschlaege(suchbegriff);
      if (laufId !== suchLaufId.current) return; // veraltete Antwort verwerfen
      setVorschlaege(treffer);
      setZeigeVorschlaege(treffer.length > 0);
    }, 350);
  }

  function waehleVorschlag(vorschlag: SongVorschlag) {
    setSongForm({
      titel: vorschlag.titel,
      interpret: vorschlag.interpret,
      dauer: vorschlag.dauerSekunden !== null ? formatDauer(vorschlag.dauerSekunden) : "",
    });
    setZeigeVorschlaege(false);
    setVorschlaege([]);
  }

  function toggleRecording(recording: string) {
    const aktiv = produktion.recordings.includes(recording);
    const next = aktiv
      ? produktion.recordings.filter((r) => r !== recording)
      : [...produktion.recordings, recording];
    onChange({ recordings: next });
  }

  async function handleSongHinzufuegen() {
    if (!songForm.titel.trim() || songLaeuft) return;
    setZeigeVorschlaege(false);
    setSongLaeuft(true);
    setSongFehler(null);
    setSongGespeichert(null);
    const ergebnis = await fuegeSongHinzu(
      bandId,
      songForm.titel,
      songForm.interpret || null,
      songForm.dauer ? parseDauerEingabe(songForm.dauer) : null
    );
    setSongLaeuft(false);
    if (!ergebnis.ok) {
      setSongFehler(ergebnis.fehler);
      return;
    }
    setSongGespeichert(`„${ergebnis.song.titel}" zum Katalog hinzugefügt`);
    setSongForm({ titel: "", interpret: "", dauer: "" });
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
          <div className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/50">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Fertigen Song zum Katalog hinzufügen
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative w-full">
                <input
                  value={songForm.titel}
                  onChange={(e) => handleTitelChange(e.target.value)}
                  onFocus={() => vorschlaege.length > 0 && setZeigeVorschlaege(true)}
                  onBlur={() => setTimeout(() => setZeigeVorschlaege(false), 120)}
                  placeholder="Titel"
                  className={inputClass}
                />
                {zeigeVorschlaege && (
                  <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                    {vorschlaege.map((v, i) => (
                      <li key={`${v.titel}-${v.interpret}-${i}`}>
                        <button
                          type="button"
                          // onMouseDown statt onClick: feuert vor dem Input-blur,
                          // sonst würde die Liste weg sein, bevor der Klick greift.
                          onMouseDown={(e) => {
                            e.preventDefault();
                            waehleVorschlag(v);
                          }}
                          className="flex w-full items-baseline justify-between gap-3 px-2.5 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-slate-100">
                            {v.titel}
                            {v.interpret && (
                              <span className="text-slate-500 dark:text-slate-400"> · {v.interpret}</span>
                            )}
                          </span>
                          {v.dauerSekunden !== null && (
                            <span className="shrink-0 text-xs text-slate-400">
                              {formatDauer(v.dauerSekunden)}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <input
                value={songForm.interpret}
                onChange={(e) => setSongForm((prev) => ({ ...prev, interpret: e.target.value }))}
                placeholder="Interpret"
                className={inputClass}
              />
              <input
                value={songForm.dauer}
                onChange={(e) => setSongForm((prev) => ({ ...prev, dauer: e.target.value }))}
                placeholder="3:42"
                className={`${inputClass} sm:w-20`}
              />
              <button
                type="button"
                onClick={handleSongHinzufuegen}
                disabled={songLaeuft}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                + Song
              </button>
            </div>
            {songFehler && <p className="text-xs text-red-600">{songFehler}</p>}
            {songGespeichert && (
              <p className="text-xs text-green-600 dark:text-green-400">{songGespeichert}</p>
            )}
          </div>

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
            bandId={bandId}
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
