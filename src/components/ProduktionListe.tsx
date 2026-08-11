"use client";

import { Fragment, useRef, useState } from "react";
import clsx from "clsx";
import {
  aktualisiereProduktion,
  erstelleProduktion,
  loescheProduktion,
  uebernehmeInKatalog,
} from "@/lib/produktionActions";
import { parseDauerEingabe } from "@/lib/dauer";
import {
  PRODUKTION_NOTEN,
  PRODUKTION_RECORDINGS,
  PRODUKTION_STEPS,
} from "@/lib/constants";
import { sortiereProduktionen } from "@/lib/produktionHelpers";
import type { Produktion, ProduktionMitSong } from "@/lib/types";

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

// Note als Ampel: gute Songs gruen, mittlere neutral, schwache gedaempft.
// Bewusst dezent - die Note steuert vor allem die Reihenfolge, die Farbe ist
// nur eine Lesehilfe beim Ueberfliegen.
function noteBadgeClass(note: number): string {
  if (note <= 2)
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200";
  if (note <= 4)
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200";
  return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
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
  bandName,
  produktion,
  offen,
  onToggle,
  onChange,
  onLoeschen,
  onUebernommen,
}: {
  bandId: string;
  bandName: string;
  produktion: ProduktionMitSong;
  offen: boolean;
  onToggle: () => void;
  onChange: (werte: Partial<Produktion>) => void;
  onLoeschen: () => void;
  onUebernommen: (song: { id: string; titel: string }) => void;
}) {
  const titel = produktion.name.trim() || "Ohne Titel";
  const recordingsText = produktion.recordings.join(" · ");

  // Übernahme in den Songkatalog: Der Arbeitstitel ist selten der spätere
  // Songtitel, deshalb ein eigenes Formular statt stumpfem Kopieren.
  const [katalogOffen, setKatalogOffen] = useState(false);
  const [katalogForm, setKatalogForm] = useState({ titel: "", interpret: "", dauer: "" });
  const [katalogFehler, setKatalogFehler] = useState<string | null>(null);
  const [katalogLaeuft, setKatalogLaeuft] = useState(false);

  function starteUebernahme() {
    setKatalogForm({
      titel: produktion.name.trim(),
      // Eigenkompositionen: Interpret ist die Band selbst.
      interpret: bandName,
      dauer: "",
    });
    setKatalogFehler(null);
    setKatalogOffen(true);
  }

  async function handleUebernehmen() {
    if (!katalogForm.titel.trim() || katalogLaeuft) return;
    setKatalogLaeuft(true);
    setKatalogFehler(null);
    const ergebnis = await uebernehmeInKatalog(
      produktion.id,
      bandId,
      katalogForm.titel,
      katalogForm.interpret || null,
      katalogForm.dauer ? parseDauerEingabe(katalogForm.dauer) : null
    );
    setKatalogLaeuft(false);
    if (!ergebnis.ok) {
      setKatalogFehler(ergebnis.fehler);
      return;
    }
    setKatalogOffen(false);
    onUebernommen(ergebnis.song);
  }

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
              {produktion.note !== null && (
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 font-semibold",
                    noteBadgeClass(produktion.note)
                  )}
                  title={`Priorität: Note ${produktion.note}`}
                >
                  {produktion.note}
                </span>
              )}
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
              Priorität
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {PRODUKTION_NOTEN.map((note) => {
                const aktiv = produktion.note === note;
                return (
                  <button
                    key={note}
                    type="button"
                    // Nochmaliger Klick hebt die Note wieder auf - wie beim
                    // Prozessschritt, damit man eine Fehleingabe zuruecknehmen
                    // kann, ohne auf eine andere Note ausweichen zu muessen.
                    onClick={() => onChange({ note: aktiv ? null : note })}
                    className={chipClass(aktiv)}
                    title={
                      note === 1 ? "1 = gut, steht oben" : note === 6 ? "6 = steht unten" : undefined
                    }
                  >
                    {note}
                  </button>
                );
              })}
              <span className="text-xs text-slate-400 dark:text-slate-500">
                1 = gut (oben) · 6 = unten
              </span>
            </div>
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

          {/* Rückweg in den Katalog: erst wenn der Song fertig ist. Danach
              zeigt die Karte nur noch, wohin er gewandert ist. */}
          <div className="border-t border-slate-100 pt-3 dark:border-slate-700">
            {produktion.song ? (
              <p className="text-xs font-medium text-green-600 dark:text-green-400">
                ✓ Im Songkatalog: {produktion.song.titel}
              </p>
            ) : katalogOffen ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  In den Songkatalog übernehmen
                </span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={katalogForm.titel}
                    onChange={(e) =>
                      setKatalogForm((prev) => ({ ...prev, titel: e.target.value }))
                    }
                    placeholder="Songtitel"
                    className={inputClass}
                  />
                  <input
                    value={katalogForm.interpret}
                    onChange={(e) =>
                      setKatalogForm((prev) => ({ ...prev, interpret: e.target.value }))
                    }
                    placeholder="Interpret"
                    className={inputClass}
                  />
                  <input
                    value={katalogForm.dauer}
                    onChange={(e) =>
                      setKatalogForm((prev) => ({ ...prev, dauer: e.target.value }))
                    }
                    placeholder="3:42"
                    className={`${inputClass} sm:w-20`}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleUebernehmen}
                    disabled={katalogLaeuft}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {katalogLaeuft ? "Übernehme…" : "Übernehmen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKatalogOffen(false)}
                    className="text-sm text-slate-500 underline hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Abbrechen
                  </button>
                </div>
                {katalogFehler && <p className="text-xs text-red-600">{katalogFehler}</p>}
              </div>
            ) : (
              <button
                type="button"
                onClick={starteUebernahme}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                → In den Songkatalog übernehmen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProduktionListe({
  bandId,
  bandName,
  initialProduktionen,
}: {
  bandId: string;
  bandName: string;
  initialProduktionen: ProduktionMitSong[];
}) {
  const [produktionen, setProduktionen] =
    useState<ProduktionMitSong[]>(initialProduktionen);
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
        note: produktion.note,
      }).catch((err) => console.error("Produktion speichern fehlgeschlagen", err));
    }, 500);
  }

  function handleChange(produktionId: string, werte: Partial<Produktion>) {
    setProduktionen((prev) => {
      const next = prev.map((p) => (p.id === produktionId ? { ...p, ...werte } : p));
      const aktualisiert = next.find((p) => p.id === produktionId);
      if (aktualisiert) speicherePlanen(aktualisiert);
      // Nur bei einer Notenvergabe umsortieren: Der Eintrag wandert sofort an
      // seinen Platz, damit man die Wirkung der Note sieht. Beim Tippen in
      // Name/Datum wäre Umsortieren dagegen störend - deshalb nicht generell.
      return "note" in werte ? sortiereProduktionen(next) : next;
    });
  }

  // Übernommene Produktionen rutschen ans Ende - oben bleiben die laufenden
  // Arbeiten, die Historie stört dort nicht.
  function handleUebernommen(produktionId: string, song: { id: string; titel: string }) {
    setProduktionen((prev) =>
      sortiereProduktionen(
        prev.map((p) => (p.id === produktionId ? { ...p, song_id: song.id, song } : p))
      )
    );
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
    setProduktionen((prev) => [{ ...ergebnis.produktion, song: null }, ...prev]);
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

      {/* Oben, weil neue Einträge oben in der Liste erscheinen - so steht der
          Knopf direkt über dem, was er erzeugt. */}
      <button
        type="button"
        onClick={handleNeu}
        className="self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        + Neuer Eintrag
      </button>

      {produktionen.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Noch keine Produktions-Einträge.
        </p>
      ) : (
        produktionen.map((produktion, index) => {
          // Trennlinie vor der ersten bereits übernommenen Produktion - darüber
          // laufende Arbeiten, darunter die fertigen im Katalog.
          const vorherige = produktionen[index - 1];
          const ersteErledigte =
            Boolean(produktion.song_id) && (index === 0 || !vorherige?.song_id);

          return (
            <Fragment key={produktion.id}>
              {ersteErledigte && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    Fertig · im Songkatalog
                  </span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>
              )}
              <ProduktionKarte
                bandId={bandId}
                bandName={bandName}
                produktion={produktion}
                offen={offeneIds.has(produktion.id)}
                onToggle={() => toggleOffen(produktion.id)}
                onChange={(werte) => handleChange(produktion.id, werte)}
                onLoeschen={() => handleLoeschen(produktion.id)}
                onUebernommen={(song) => handleUebernommen(produktion.id, song)}
              />
            </Fragment>
          );
        })
      )}

    </div>
  );
}
