"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  erstelleBeleg,
  getBelegDateiUrl,
  liesBelegBildAus,
  setzeBelegErstattet,
} from "@/lib/belegActions";
import { formatEuro } from "@/lib/angebotHelpers";
import { BELEG_KATEGORIE_LABELS } from "@/lib/belegKategorien";
import type { Beleg, Band } from "@/lib/types";
import type { BelegKategorie } from "@/lib/database.types";

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

// Belege am Desktop: erfassen (mit Foto/PDF und KI-Vorbefüllung) und die
// Liste mit Erstattungs-Status. Belege werden nie gelöscht.
export function BelegePanel({
  bands,
  vorgewaehlteBandId,
  mitgliederProBand,
  belege,
}: {
  bands: Band[];
  // Band aus dem Seitenfilter - null bei "Beide".
  vorgewaehlteBandId: string | null;
  mitgliederProBand: Record<string, { id: string; name: string }[]>;
  belege: Beleg[];
}) {
  const router = useRouter();
  const dateiRef = useRef<HTMLInputElement>(null);
  const [formOffen, setFormOffen] = useState(false);
  // Nur relevant, wenn der Seitenfilter auf "Beide" steht - sonst gilt IMMER
  // die gefilterte Band (sonst zeigte das Formular nach einem Filterwechsel
  // die Mitglieder der vorherigen Band und speicherte dorthin).
  const [gewaehlteBandId, setGewaehlteBandId] = useState(bands[0]?.id ?? "");
  const bandId = vorgewaehlteBandId ?? gewaehlteBandId;
  const [felder, setFelder] = useState({
    datum: new Date().toISOString().slice(0, 10),
    betrag: "",
    haendler: "",
    beschreibung: "",
    kategorie: "sonstiges" as BelegKategorie,
    mitgliedId: "",
  });
  const [liestAus, setLiestAus] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const bandName = (id: string | null) =>
    bands.find((b) => b.id === id)?.name ?? "";

  // Beim Auswählen eines Fotos liest die KI Betrag/Datum/Händler vor - nur
  // als Vorschlag, leere Felder werden gefüllt, Eingetipptes bleibt stehen.
  async function handleDatei(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    if (!datei || !datei.type.startsWith("image/")) return;
    setLiestAus(true);
    const formData = new FormData();
    formData.set("datei", datei);
    const ergebnis = await liesBelegBildAus(formData);
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
    if (!bandId) return;
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);

    const formData = new FormData();
    formData.set("datum", felder.datum);
    formData.set("betrag", felder.betrag);
    formData.set("haendler", felder.haendler);
    formData.set("beschreibung", felder.beschreibung);
    formData.set("kategorie", felder.kategorie);
    formData.set("mitglied_id", felder.mitgliedId);
    const datei = dateiRef.current?.files?.[0];
    if (datei) formData.set("datei", datei);

    const ergebnis = await erstelleBeleg(bandId, formData);
    setLaeuft(false);
    if (!ergebnis.ok) return setFehler(ergebnis.fehler);

    setFelder({
      datum: new Date().toISOString().slice(0, 10),
      betrag: "",
      haendler: "",
      beschreibung: "",
      kategorie: "sonstiges",
      mitgliedId: "",
    });
    if (dateiRef.current) dateiRef.current.value = "";
    setMeldung("Beleg gespeichert.");
    setFormOffen(false);
    router.refresh();
  }

  async function oeffneDatei(beleg: Beleg) {
    const ergebnis = await getBelegDateiUrl(beleg.id);
    if (ergebnis.ok) window.open(ergebnis.url, "_blank");
    else setFehler(ergebnis.fehler);
  }

  async function toggleErstattet(beleg: Beleg) {
    const ergebnis = await setzeBelegErstattet(beleg.id, !beleg.erstattet_am);
    if (!ergebnis.ok) setFehler(ergebnis.fehler);
    else router.refresh();
  }

  const mitglieder = mitgliederProBand[bandId] ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-900">Belege (Ausgaben)</h2>
        <button
          type="button"
          onClick={() => setFormOffen((offen) => !offen)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          {formOffen ? "Schließen" : "+ Beleg erfassen"}
        </button>
      </div>

      {formOffen && (
        <div className="mb-4 flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {!vorgewaehlteBandId && (
              <select
                value={bandId}
                onChange={(e) => setGewaehlteBandId(e.target.value)}
                className={inputClass}
              >
                {bands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={felder.datum}
              onChange={(e) => setFelder((p) => ({ ...p, datum: e.target.value }))}
              className={inputClass}
            />
            <input
              value={felder.betrag}
              onChange={(e) => setFelder((p) => ({ ...p, betrag: e.target.value }))}
              placeholder="Betrag, z. B. 12,34"
              inputMode="decimal"
              className={inputClass}
            />
            <select
              value={felder.kategorie}
              onChange={(e) =>
                setFelder((p) => ({ ...p, kategorie: e.target.value as BelegKategorie }))
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
              value={felder.haendler}
              onChange={(e) => setFelder((p) => ({ ...p, haendler: e.target.value }))}
              placeholder="Händler / Aussteller"
              className={inputClass}
            />
            <select
              value={mitglieder.some((m) => m.id === felder.mitgliedId) ? felder.mitgliedId : ""}
              onChange={(e) => setFelder((p) => ({ ...p, mitgliedId: e.target.value }))}
              className={inputClass}
              title="Wer hat bezahlt?"
            >
              <option value="">Bandkasse / Bandkonto</option>
              {mitglieder.map((m) => (
                <option key={m.id} value={m.id}>
                  ausgelegt von {m.name}
                </option>
              ))}
            </select>
          </div>
          <input
            value={felder.beschreibung}
            onChange={(e) =>
              setFelder((p) => ({ ...p, beschreibung: e.target.value }))
            }
            placeholder="Wofür? (z. B. Kabel für PA, Sprit zum Gig in Köln)"
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={dateiRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleDatei}
              className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {liestAus && (
              <span className="text-xs text-slate-500">
                Foto wird ausgelesen…
              </span>
            )}
            <button
              type="button"
              onClick={speichern}
              disabled={laeuft || liestAus}
              className="ml-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {laeuft ? "Speichert…" : "Beleg speichern"}
            </button>
          </div>
        </div>
      )}

      {fehler && <p className="mb-2 text-sm text-red-600">{fehler}</p>}
      {meldung && <p className="mb-2 text-sm text-green-700">{meldung}</p>}

      {belege.length === 0 ? (
        <p className="text-sm text-slate-400">
          Noch keine Belege im gewählten Zeitraum.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Datum</th>
                <th className="py-2 pr-3 font-medium">Kategorie</th>
                <th className="py-2 pr-3 font-medium">Beschreibung</th>
                {!vorgewaehlteBandId && <th className="py-2 pr-3 font-medium">Band</th>}
                <th className="py-2 pr-3 text-right font-medium">Betrag</th>
                <th className="py-2 pr-3 font-medium">Auslage</th>
                <th className="py-2 font-medium">Datei</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {belege.map((beleg) => (
                <tr key={beleg.id}>
                  <td className="py-2 pr-3 text-slate-600">
                    {new Date(beleg.datum).toLocaleDateString("de-DE")}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {BELEG_KATEGORIE_LABELS[beleg.kategorie]}
                  </td>
                  <td className="max-w-[240px] truncate py-2 pr-3 text-slate-600">
                    {[beleg.haendler, beleg.beschreibung].filter(Boolean).join(" · ") ||
                      "–"}
                  </td>
                  {!vorgewaehlteBandId && (
                    <td className="py-2 pr-3 text-slate-500">
                      {bandName(beleg.band_id)}
                    </td>
                  )}
                  <td className="py-2 pr-3 text-right font-medium text-slate-900">
                    {formatEuro(Number(beleg.betrag))}
                  </td>
                  <td className="py-2 pr-3">
                    {beleg.mitglied_name ? (
                      <button
                        type="button"
                        onClick={() => toggleErstattet(beleg)}
                        className={
                          beleg.erstattet_am
                            ? "text-xs font-medium text-green-700 hover:underline"
                            : "text-xs font-medium text-amber-700 hover:underline"
                        }
                        title="Klick wechselt zwischen offen und erstattet"
                      >
                        {beleg.mitglied_name}:{" "}
                        {beleg.erstattet_am ? "erstattet ✓" : "offen"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Bandkasse</span>
                    )}
                  </td>
                  <td className="py-2">
                    {beleg.datei_pfad ? (
                      <button
                        type="button"
                        onClick={() => oeffneDatei(beleg)}
                        className="text-xs text-slate-600 underline hover:text-slate-900"
                      >
                        ansehen
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
