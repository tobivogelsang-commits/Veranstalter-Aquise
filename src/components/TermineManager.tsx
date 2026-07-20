"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  erstelleTermin,
  aktualisiereTermin,
  loescheTermin,
  type TerminEingabe,
} from "@/lib/terminActions";
import {
  ALLE_BANDS_PARAM,
  TERMIN_TYPEN,
  TERMIN_TYP_FARBE,
  TERMIN_TYP_LABEL,
  TERMIN_WIEDERHOLUNGEN,
  TERMIN_WIEDERHOLUNG_LABEL,
} from "@/lib/constants";
import type { KalenderTermin } from "@/lib/types";
import type { TerminTyp, TerminWiederholung } from "@/lib/database.types";

type BandOption = { id: string; name: string };

const inputClass =
  "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

function formatDatum(datum: string): string {
  return datum.split("-").reverse().join(".");
}

// Postgres liefert time als "HH:MM:SS" zurück; für die Anzeige auf "HH:MM"
// kürzen. Das <input type="time"> liefert bereits "HH:MM".
function formatUhrzeit(uhrzeit: string): string {
  return uhrzeit.slice(0, 5);
}

type FormState = {
  bandId: string;
  typ: TerminTyp;
  titel: string;
  datum: string;
  datumBis: string;
  uhrzeit: string;
  ort: string;
  notiz: string;
  wiederholung: TerminWiederholung;
  wiederholungBis: string;
};

function leeresFormular(vorgabeBandId: string): FormState {
  return {
    bandId: vorgabeBandId,
    typ: "probe",
    titel: "",
    datum: "",
    datumBis: "",
    uhrzeit: "",
    ort: "",
    notiz: "",
    wiederholung: "einmalig",
    wiederholungBis: "",
  };
}

export function TermineManager({
  bands,
  bandFilter,
  initialTermine,
}: {
  bands: BandOption[];
  bandFilter: string;
  initialTermine: KalenderTermin[];
}) {
  const [termine, setTermine] = useState<KalenderTermin[]>(initialTermine);
  const [offen, setOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const vorgabeBandId =
    bandFilter !== ALLE_BANDS_PARAM ? bandFilter : bands[0]?.id ?? "";
  const [form, setForm] = useState<FormState>(() => leeresFormular(vorgabeBandId));

  const bandName = (id: string) => bands.find((b) => b.id === id)?.name ?? "";

  function oeffneNeu() {
    setForm(leeresFormular(vorgabeBandId));
    setBearbeiteId(null);
    setFehler(null);
    setOffen(true);
  }

  function oeffneBearbeiten(termin: KalenderTermin) {
    setForm({
      bandId: termin.band_id,
      typ: termin.typ,
      titel: termin.titel,
      datum: termin.datum,
      datumBis: termin.datum_bis ?? "",
      uhrzeit: termin.uhrzeit ? formatUhrzeit(termin.uhrzeit) : "",
      ort: termin.ort ?? "",
      notiz: termin.notiz ?? "",
      wiederholung: termin.wiederholung,
      wiederholungBis: termin.wiederholung_bis ?? "",
    });
    setBearbeiteId(termin.id);
    setFehler(null);
    setOffen(true);
  }

  function schliessen() {
    setOffen(false);
    setBearbeiteId(null);
    setFehler(null);
  }

  async function handleSpeichern() {
    if (!form.bandId) {
      setFehler("Bitte eine Band wählen.");
      return;
    }
    const eingabe: TerminEingabe = {
      typ: form.typ,
      titel: form.titel,
      datum: form.datum,
      datumBis: form.datumBis || null,
      uhrzeit: form.uhrzeit || null,
      ort: form.ort || null,
      notiz: form.notiz || null,
      wiederholung: form.wiederholung,
      wiederholungBis: form.wiederholungBis || null,
    };

    setLaeuft(true);
    setFehler(null);
    const ergebnis = bearbeiteId
      ? await aktualisiereTermin(bearbeiteId, form.bandId, eingabe)
      : await erstelleTermin(form.bandId, eingabe);
    setLaeuft(false);

    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }

    setTermine((prev) => {
      const ohne = prev.filter((t) => t.id !== ergebnis.termin.id);
      return [...ohne, ergebnis.termin].sort((a, b) => a.datum.localeCompare(b.datum));
    });
    schliessen();
  }

  async function handleLoeschen(termin: KalenderTermin) {
    if (!confirm(`Termin "${termin.titel}" wirklich löschen?`)) return;
    const ergebnis = await loescheTermin(termin.id, termin.band_id);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    setTermine((prev) => prev.filter((t) => t.id !== termin.id));
  }

  const sichtbareTermine = termine
    .filter((t) => bandFilter === ALLE_BANDS_PARAM || t.band_id === bandFilter)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Eigene Termine ({sichtbareTermine.length})
        </h2>
        {!offen && (
          <button
            type="button"
            onClick={oeffneNeu}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            + Termin
          </button>
        )}
      </div>

      {offen && (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {bandFilter === ALLE_BANDS_PARAM && (
              <select
                value={form.bandId}
                onChange={(e) => setForm((f) => ({ ...f, bandId: e.target.value }))}
                className={inputClass}
              >
                {bands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={form.typ}
              onChange={(e) => setForm((f) => ({ ...f, typ: e.target.value as TerminTyp }))}
              className={inputClass}
            >
              {TERMIN_TYPEN.map((typ) => (
                <option key={typ} value={typ}>
                  {TERMIN_TYP_LABEL[typ]}
                </option>
              ))}
            </select>
          </div>
          <input
            value={form.titel}
            onChange={(e) => setForm((f) => ({ ...f, titel: e.target.value }))}
            placeholder="Titel (z. B. Bandprobe)"
            className={inputClass}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-0.5 text-xs text-slate-500">
              Datum
              <input
                type="date"
                value={form.datum}
                onChange={(e) => setForm((f) => ({ ...f, datum: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-0.5 text-xs text-slate-500">
              Wiederholung
              <select
                value={form.wiederholung}
                onChange={(e) =>
                  setForm((f) => ({ ...f, wiederholung: e.target.value as TerminWiederholung }))
                }
                className={inputClass}
              >
                {TERMIN_WIEDERHOLUNGEN.map((w) => (
                  <option key={w} value={w}>
                    {TERMIN_WIEDERHOLUNG_LABEL[w]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {form.wiederholung === "einmalig" ? (
            <label className="flex flex-col gap-0.5 text-xs text-slate-500">
              Enddatum – nur für mehrtägige Termine (optional)
              <input
                type="date"
                value={form.datumBis}
                onChange={(e) => setForm((f) => ({ ...f, datumBis: e.target.value }))}
                className={inputClass}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-0.5 text-xs text-slate-500">
              Wiederholt sich bis (optional, leer = offen)
              <input
                type="date"
                value={form.wiederholungBis}
                onChange={(e) => setForm((f) => ({ ...f, wiederholungBis: e.target.value }))}
                className={inputClass}
              />
            </label>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-0.5 text-xs text-slate-500">
              Uhrzeit (optional)
              <input
                type="time"
                value={form.uhrzeit}
                onChange={(e) => setForm((f) => ({ ...f, uhrzeit: e.target.value }))}
                className={inputClass}
              />
            </label>
            <input
              value={form.ort}
              onChange={(e) => setForm((f) => ({ ...f, ort: e.target.value }))}
              placeholder="Ort (optional)"
              className={`${inputClass} self-end`}
            />
          </div>
          <textarea
            value={form.notiz}
            onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))}
            placeholder="Notiz (optional)"
            rows={2}
            className={inputClass}
          />
          {fehler && <p className="text-xs text-red-600">{fehler}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={laeuft}
              onClick={handleSpeichern}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {laeuft ? "Speichern…" : bearbeiteId ? "Speichern" : "Anlegen"}
            </button>
            <button
              type="button"
              onClick={schliessen}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {sichtbareTermine.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {sichtbareTermine.map((termin) => (
            <li
              key={termin.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-1.5 text-sm dark:border-slate-700"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={clsx(
                    "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                    TERMIN_TYP_FARBE[termin.typ].pill
                  )}
                >
                  {TERMIN_TYP_LABEL[termin.typ]}
                </span>
                <span className="truncate text-slate-900 dark:text-slate-100">{termin.titel}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  {termin.wiederholung === "einmalig"
                    ? formatDatum(termin.datum)
                    : `ab ${formatDatum(termin.datum)}`}
                  {termin.datum_bis ? `–${formatDatum(termin.datum_bis)}` : ""}
                  {termin.uhrzeit ? ` · ${formatUhrzeit(termin.uhrzeit)}` : ""}
                  {termin.wiederholung !== "einmalig"
                    ? ` · ${TERMIN_WIEDERHOLUNG_LABEL[termin.wiederholung]}`
                    : ""}
                  {bandFilter === ALLE_BANDS_PARAM ? ` · ${bandName(termin.band_id)}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => oeffneBearbeiten(termin)}
                  className="text-xs text-slate-600 underline hover:text-slate-900"
                >
                  bearbeiten
                </button>
                <button
                  type="button"
                  onClick={() => handleLoeschen(termin)}
                  className="text-xs text-red-600 underline hover:text-red-800"
                >
                  löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
