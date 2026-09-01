"use client";

import { useEffect, useRef, useState } from "react";
import {
  erstelleBelegTeam,
  holeBelegeFuerMitglied,
  liesBelegBildAusTeam,
} from "@/lib/belegActions";
import { formatEuro } from "@/lib/angebotHelpers";
import { BELEG_KATEGORIE_LABELS } from "@/lib/belegKategorien";
import type { Beleg } from "@/lib/types";
import type { BelegKategorie } from "@/lib/database.types";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

// Belege-Tab der Team-App: Beleg fotografieren (oder aus der Galerie wählen),
// die KI liest Betrag/Datum/Händler vor, kurz prüfen, absenden. Darunter die
// eigenen eingereichten Belege mit Erstattungs-Status.
export function TeamBelege({
  bandId,
  mitgliedId,
  mitgliedName,
}: {
  bandId: string;
  mitgliedId: string;
  mitgliedName: string;
}) {
  const dateiRef = useRef<HTMLInputElement>(null);
  const [belege, setBelege] = useState<Beleg[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [dateiName, setDateiName] = useState<string | null>(null);
  const [felder, setFelder] = useState({
    datum: new Date().toISOString().slice(0, 10),
    betrag: "",
    haendler: "",
    beschreibung: "",
    kategorie: "sonstiges" as BelegKategorie,
  });
  const [liestAus, setLiestAus] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  useEffect(() => {
    holeBelegeFuerMitglied(mitgliedId, bandId).then((eintraege) => {
      setBelege(eintraege);
      setGeladen(true);
    });
  }, [mitgliedId, bandId]);

  async function handleDatei(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    setDateiName(datei?.name ?? null);
    setMeldung(null);
    if (!datei || !datei.type.startsWith("image/")) return;
    setLiestAus(true);
    const formData = new FormData();
    formData.set("datei", datei);
    const ergebnis = await liesBelegBildAusTeam(bandId, mitgliedId, formData);
    setLiestAus(false);
    if (ergebnis.ok && ergebnis.vorschlag) {
      const v = ergebnis.vorschlag;
      setFelder((p) => ({
        ...p,
        betrag: p.betrag || (v.betrag ?? ""),
        datum: v.datum ?? p.datum,
        haendler: p.haendler || (v.haendler ?? ""),
      }));
    }
  }

  async function speichern() {
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);

    const formData = new FormData();
    formData.set("datum", felder.datum);
    formData.set("betrag", felder.betrag);
    formData.set("haendler", felder.haendler);
    formData.set("beschreibung", felder.beschreibung);
    formData.set("kategorie", felder.kategorie);
    const datei = dateiRef.current?.files?.[0];
    if (datei) formData.set("datei", datei);

    const ergebnis = await erstelleBelegTeam(bandId, mitgliedId, formData);
    setLaeuft(false);
    if (!ergebnis.ok) return setFehler(ergebnis.fehler);

    setBelege((prev) => [ergebnis.beleg, ...prev]);
    setFelder({
      datum: new Date().toISOString().slice(0, 10),
      betrag: "",
      haendler: "",
      beschreibung: "",
      kategorie: "sonstiges",
    });
    if (dateiRef.current) dateiRef.current.value = "";
    setDateiName(null);
    setMeldung("Beleg eingereicht – danke!");
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Beleg einreichen
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Kassenbon fotografieren – Betrag, Datum und Händler werden automatisch
          vorausgefüllt, du prüfst nur kurz. Du hast ausgelegt? Dann steht der
          Beleg als offene Erstattung bei {mitgliedName}.
        </p>

        <div className="mt-3 flex flex-col gap-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
            📷 {dateiName ?? "Foto aufnehmen oder Datei wählen"}
            <input
              ref={dateiRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleDatei}
              className="hidden"
            />
          </label>
          {liestAus && (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Beleg wird ausgelesen…
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              value={felder.betrag}
              onChange={(e) => setFelder((p) => ({ ...p, betrag: e.target.value }))}
              placeholder="Betrag, z. B. 12,34"
              inputMode="decimal"
              className={inputClass}
            />
            <input
              type="date"
              value={felder.datum}
              onChange={(e) => setFelder((p) => ({ ...p, datum: e.target.value }))}
              className={inputClass}
            />
          </div>
          <input
            value={felder.haendler}
            onChange={(e) => setFelder((p) => ({ ...p, haendler: e.target.value }))}
            placeholder="Händler / Aussteller"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={felder.kategorie}
              onChange={(e) =>
                setFelder((p) => ({
                  ...p,
                  kategorie: e.target.value as BelegKategorie,
                }))
              }
              className={inputClass}
            >
              {Object.entries(BELEG_KATEGORIE_LABELS).map(([wert, label]) => (
                <option key={wert} value={wert}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={felder.beschreibung}
              onChange={(e) =>
                setFelder((p) => ({ ...p, beschreibung: e.target.value }))
              }
              placeholder="Wofür?"
              className={inputClass}
            />
          </div>

          {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          {meldung && <p className="text-sm text-green-700 dark:text-green-400">{meldung}</p>}

          <button
            type="button"
            onClick={speichern}
            disabled={laeuft || liestAus}
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {laeuft ? "Wird eingereicht…" : "Beleg einreichen"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Meine Belege
        </h2>
        {!geladen ? (
          <p className="mt-2 text-sm text-slate-400">Lade…</p>
        ) : belege.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            Noch keine Belege eingereicht.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {belege.map((beleg) => (
              <li key={beleg.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-slate-900 dark:text-slate-100">
                    {[beleg.haendler, beleg.beschreibung].filter(Boolean).join(" · ") ||
                      BELEG_KATEGORIE_LABELS[beleg.kategorie]}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(beleg.datum).toLocaleDateString("de-DE")} ·{" "}
                    {BELEG_KATEGORIE_LABELS[beleg.kategorie]}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {formatEuro(Number(beleg.betrag))}
                  </p>
                  <p
                    className={
                      beleg.erstattet_am
                        ? "text-xs text-green-700 dark:text-green-400"
                        : "text-xs text-amber-700 dark:text-amber-400"
                    }
                  >
                    {beleg.erstattet_am ? "erstattet ✓" : "Erstattung offen"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
