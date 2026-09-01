"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  aktualisiereRechnung,
  erzeugeRechnungPdfDatei,
  loescheRechnung,
  setzeRechnungStatus,
  storniereRechnung,
} from "@/lib/rechnungActions";
import { berechneAngebotSummen, formatEuro } from "@/lib/angebotHelpers";
import { AngebotMailDialog } from "@/components/AngebotMailDialog";
import { GagenPanel } from "@/components/GagenPanel";
import type { AngebotPosition, RechnungStatus } from "@/lib/database.types";
import type {
  BandDokumentTypMitUrl,
  BandMitgliedOhnePush,
  EmailVorlage,
  GagenAnteil,
  RechnungMitBand,
} from "@/lib/types";
import type { VenueVorschlag } from "@/lib/queries";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500";

const STATUS_LABEL: Record<RechnungStatus, string> = {
  entwurf: "Entwurf",
  versendet: "Versendet",
  bezahlt: "Bezahlt",
  storniert: "Storniert",
};

const STATUS_FARBE: Record<RechnungStatus, string> = {
  entwurf: "bg-slate-100 text-slate-600",
  versendet: "bg-amber-100 text-amber-800",
  bezahlt: "bg-green-100 text-green-800",
  storniert: "bg-red-100 text-red-700",
};

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      {children}
    </label>
  );
}

// Rechnungs-Maske. Der große Unterschied zum Angebots-Editor: Ab "versendet"
// ist alles schreibgeschützt (GoBD) - Korrekturen laufen über den
// Storno-Knopf, der eine Gegenrechnung erzeugt.
export function RechnungEditor({
  rechnung,
  venues,
  vorlagen,
  dokumentTypen,
  mitglieder,
  anteile,
}: {
  rechnung: RechnungMitBand;
  venues: VenueVorschlag[];
  vorlagen: EmailVorlage[];
  dokumentTypen: BandDokumentTypMitUrl[];
  mitglieder: BandMitgliedOhnePush[];
  anteile: GagenAnteil[];
}) {
  const [form, setForm] = useState({
    titel: rechnung.titel,
    datum: rechnung.datum,
    leistungsdatum: rechnung.leistungsdatum ?? "",
    faelligAm: rechnung.faellig_am ?? "",
    empfaengerName: rechnung.empfaenger_name,
    empfaengerAnsprechpartner: rechnung.empfaenger_ansprechpartner ?? "",
    empfaengerStrasse: rechnung.empfaenger_strasse ?? "",
    empfaengerPlz: rechnung.empfaenger_plz ?? "",
    empfaengerOrt: rechnung.empfaenger_ort ?? "",
    einleitung: rechnung.einleitung ?? "",
    zahlungsbedingungen: rechnung.zahlungsbedingungen ?? "",
    nachbemerkung: rechnung.nachbemerkung ?? "",
    ustSatz: rechnung.ust_satz,
  });
  const [positionen, setPositionen] = useState<AngebotPosition[]>(
    rechnung.positionen.length > 0
      ? rechnung.positionen
      : [{ beschreibung: "", betrag: 0 }]
  );
  const [venueId, setVenueId] = useState<string | null>(rechnung.venue_id);
  const [venueEmail, setVenueEmail] = useState<string | null>(
    venues.find((v) => v.id === rechnung.venue_id)?.email ?? null
  );
  const [zeigeVorschlaege, setZeigeVorschlaege] = useState(false);
  const [mailOffen, setMailOffen] = useState(false);
  const [status, setStatus] = useState<RechnungStatus>(rechnung.status);
  const [pdfDateiname, setPdfDateiname] = useState<string | null>(
    rechnung.pdf_dateiname
  );
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const summen = berechneAngebotSummen(positionen, form.ustSatz);
  // Ab "versendet" ist die Rechnung eingefroren.
  const gesperrt = status !== "entwurf";
  const ueberfaellig =
    status === "versendet" &&
    Boolean(form.faelligAm) &&
    form.faelligAm < new Date().toISOString().slice(0, 10);

  const treffer =
    !gesperrt && form.empfaengerName.trim().length > 0
      ? venues
          .filter((v) =>
            v.name.toLowerCase().includes(form.empfaengerName.trim().toLowerCase())
          )
          .slice(0, 8)
      : [];

  function waehleVenue(venue: VenueVorschlag) {
    setForm((p) => ({
      ...p,
      empfaengerName: venue.name,
      empfaengerAnsprechpartner: venue.ansprechpartner ?? "",
      empfaengerStrasse: venue.strasse ?? "",
      empfaengerOrt: venue.ort ?? "",
    }));
    setVenueId(venue.id);
    setVenueEmail(venue.email);
    setZeigeVorschlaege(false);
  }

  function setzePosition(index: number, werte: Partial<AngebotPosition>) {
    setPositionen((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...werte } : p))
    );
  }

  async function speichere(): Promise<boolean> {
    if (gesperrt) return true;
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);
    const ergebnis = await aktualisiereRechnung(rechnung.id, {
      titel: form.titel,
      datum: form.datum,
      leistungsdatum: form.leistungsdatum || null,
      faelligAm: form.faelligAm || null,
      venueId,
      empfaengerName: form.empfaengerName,
      empfaengerAnsprechpartner: form.empfaengerAnsprechpartner || null,
      empfaengerStrasse: form.empfaengerStrasse || null,
      empfaengerPlz: form.empfaengerPlz || null,
      empfaengerOrt: form.empfaengerOrt || null,
      einleitung: form.einleitung || null,
      positionen,
      ustSatz: form.ustSatz,
      zahlungsbedingungen: form.zahlungsbedingungen || null,
      nachbemerkung: form.nachbemerkung || null,
    });
    setLaeuft(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return false;
    }
    return true;
  }

  async function handleSpeichern() {
    if (await speichere()) setMeldung("Gespeichert.");
  }

  async function handlePdf() {
    if (!(await speichere())) return;
    setLaeuft(true);
    const ergebnis = await erzeugeRechnungPdfDatei(rechnung.id);
    setLaeuft(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    setPdfDateiname(ergebnis.dateiname);
    setMeldung("PDF erzeugt.");
    window.open(`/api/rechnung/${rechnung.id}/pdf`, "_blank");
  }

  async function handleBezahlt(bezahlt: boolean) {
    setFehler(null);
    const neu = bezahlt ? "bezahlt" : "versendet";
    setStatus(neu);
    const ergebnis = await setzeRechnungStatus(rechnung.id, neu);
    if (!ergebnis.ok) {
      setStatus(status);
      setFehler(ergebnis.fehler);
    }
  }

  async function handleStorno() {
    if (
      !confirm(
        `Rechnung ${rechnung.nummer} stornieren? Es entsteht eine Stornorechnung mit negativen Beträgen; das Original bleibt unverändert bestehen.`
      )
    ) {
      return;
    }
    setLaeuft(true);
    const ergebnis = await storniereRechnung(rechnung.id);
    // Bei Erfolg leitet die Action zur Stornorechnung um.
    setLaeuft(false);
    if (ergebnis && !ergebnis.ok) setFehler(ergebnis.fehler);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {rechnung.nummer}
        </span>
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            ueberfaellig ? "bg-red-100 text-red-700" : STATUS_FARBE[status]
          )}
        >
          {ueberfaellig ? "Überfällig" : STATUS_LABEL[status]}
        </span>
        {rechnung.bezahlt_am && status === "bezahlt" && (
          <span className="text-xs text-slate-500">
            bezahlt am {new Date(rechnung.bezahlt_am).toLocaleDateString("de-DE")}
          </span>
        )}
        <span className="text-sm text-slate-500">{rechnung.band.name}</span>
        {gesperrt && status !== "storniert" && (
          <span className="text-xs text-slate-400">
            Versendete Rechnungen sind unveränderbar – Korrektur per Storno.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium text-slate-900">Empfänger</h2>
          <Feld label="Name">
            <div className="relative">
              <input
                value={form.empfaengerName}
                disabled={gesperrt}
                onChange={(e) => {
                  setForm((p) => ({ ...p, empfaengerName: e.target.value }));
                  setZeigeVorschlaege(true);
                  setVenueId(null);
                }}
                onFocus={() => setZeigeVorschlaege(true)}
                onBlur={() => setTimeout(() => setZeigeVorschlaege(false), 120)}
                placeholder="Name des Veranstalters"
                className={inputClass}
              />
              {zeigeVorschlaege && treffer.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  {treffer.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          waehleVenue(v);
                        }}
                        className="w-full px-2.5 py-1.5 text-left hover:bg-slate-100"
                      >
                        <span className="block truncate text-sm text-slate-900">
                          {v.name}
                        </span>
                        {(v.ort || v.ansprechpartner) && (
                          <span className="block truncate text-xs text-slate-500">
                            {[v.ort, v.ansprechpartner].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Feld>
          <Feld label="Ansprechpartner">
            <input
              value={form.empfaengerAnsprechpartner}
              disabled={gesperrt}
              onChange={(e) =>
                setForm((p) => ({ ...p, empfaengerAnsprechpartner: e.target.value }))
              }
              className={inputClass}
            />
          </Feld>
          <Feld label="Straße & Hausnummer">
            <input
              value={form.empfaengerStrasse}
              disabled={gesperrt}
              onChange={(e) =>
                setForm((p) => ({ ...p, empfaengerStrasse: e.target.value }))
              }
              className={inputClass}
            />
          </Feld>
          <div className="grid grid-cols-3 gap-2">
            <Feld label="PLZ">
              <input
                value={form.empfaengerPlz}
                disabled={gesperrt}
                onChange={(e) => setForm((p) => ({ ...p, empfaengerPlz: e.target.value }))}
                className={inputClass}
              />
            </Feld>
            <div className="col-span-2">
              <Feld label="Ort">
                <input
                  value={form.empfaengerOrt}
                  disabled={gesperrt}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, empfaengerOrt: e.target.value }))
                  }
                  className={inputClass}
                />
              </Feld>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium text-slate-900">Eckdaten</h2>
          <Feld label="Titel">
            <input
              value={form.titel}
              disabled={gesperrt}
              onChange={(e) => setForm((p) => ({ ...p, titel: e.target.value }))}
              className={inputClass}
            />
          </Feld>
          <div className="grid grid-cols-2 gap-2">
            <Feld label="Rechnungsdatum">
              <input
                type="date"
                value={form.datum}
                disabled={gesperrt}
                onChange={(e) => setForm((p) => ({ ...p, datum: e.target.value }))}
                className={inputClass}
              />
            </Feld>
            <Feld label="Leistungsdatum (Auftritt)">
              <input
                type="date"
                value={form.leistungsdatum}
                disabled={gesperrt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, leistungsdatum: e.target.value }))
                }
                className={inputClass}
              />
            </Feld>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Feld label="Zahlbar bis">
              <input
                type="date"
                value={form.faelligAm}
                disabled={gesperrt}
                onChange={(e) => setForm((p) => ({ ...p, faelligAm: e.target.value }))}
                className={inputClass}
              />
            </Feld>
            <Feld label="Umsatzsteuer">
              <select
                value={String(form.ustSatz)}
                disabled={gesperrt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ustSatz: Number(e.target.value) }))
                }
                className={inputClass}
              >
                <option value="0">Keine (§ 19 UStG)</option>
                <option value="7">7 % (ermäßigt)</option>
                <option value="19">19 %</option>
              </select>
            </Feld>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-900">Einleitung</h2>
        <textarea
          value={form.einleitung}
          disabled={gesperrt}
          onChange={(e) => setForm((p) => ({ ...p, einleitung: e.target.value }))}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-900">Leistungen</h2>
        <div className="flex flex-col gap-2">
          {positionen.map((position, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 w-5 shrink-0 text-xs text-slate-400">{i + 1}</span>
              <textarea
                value={position.beschreibung}
                disabled={gesperrt}
                onChange={(e) => setzePosition(i, { beschreibung: e.target.value })}
                rows={2}
                placeholder="z. B. Live-Auftritt 2 x 45 Minuten inkl. Anlage und Licht"
                className={inputClass}
              />
              <input
                type="number"
                step="0.01"
                value={position.betrag || ""}
                disabled={gesperrt}
                onChange={(e) => setzePosition(i, { betrag: Number(e.target.value) })}
                placeholder="0,00"
                className="w-32 shrink-0 rounded-md border border-slate-300 px-3 py-2 text-right text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
              />
              {!gesperrt && (
                <button
                  type="button"
                  onClick={() => setPositionen((prev) => prev.filter((_, x) => x !== i))}
                  className="mt-2 shrink-0 text-slate-300 hover:text-red-600"
                  title="Position entfernen"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {!gesperrt && (
          <button
            type="button"
            onClick={() =>
              setPositionen((prev) => [...prev, { beschreibung: "", betrag: 0 }])
            }
            className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            + Position
          </button>
        )}

        <div className="mt-4 flex flex-col items-end gap-1 border-t border-slate-200 pt-3 text-sm">
          {form.ustSatz > 0 ? (
            <>
              <div className="flex gap-6">
                <span className="text-slate-500">Summe (netto)</span>
                <span className="w-28 text-right">{formatEuro(summen.netto)}</span>
              </div>
              <div className="flex gap-6">
                <span className="text-slate-500">zzgl. {form.ustSatz} % USt</span>
                <span className="w-28 text-right">{formatEuro(summen.steuer)}</span>
              </div>
              <div className="flex gap-6 font-semibold">
                <span>Rechnungsbetrag</span>
                <span className="w-28 text-right">{formatEuro(summen.brutto)}</span>
              </div>
            </>
          ) : (
            <div className="flex gap-6 font-semibold">
              <span>Rechnungsbetrag</span>
              <span className="w-28 text-right">{formatEuro(summen.netto)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h2 className="mb-1 text-sm font-medium text-slate-900">
            Zahlungsbedingungen
          </h2>
          <textarea
            value={form.zahlungsbedingungen}
            disabled={gesperrt}
            onChange={(e) =>
              setForm((p) => ({ ...p, zahlungsbedingungen: e.target.value }))
            }
            rows={2}
            className={inputClass}
          />
        </div>
        <div>
          <h2 className="mb-1 text-sm font-medium text-slate-900">Nachbemerkung</h2>
          <textarea
            value={form.nachbemerkung}
            disabled={gesperrt}
            onChange={(e) => setForm((p) => ({ ...p, nachbemerkung: e.target.value }))}
            rows={2}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!gesperrt && (
          <button
            type="button"
            onClick={handleSpeichern}
            disabled={laeuft}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Speichern
          </button>
        )}
        <button
          type="button"
          onClick={handlePdf}
          disabled={laeuft}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {laeuft ? "Einen Moment…" : "PDF erzeugen & ansehen"}
        </button>
        {pdfDateiname && (
          <a
            href={`/api/rechnung/${rechnung.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            {pdfDateiname}
          </a>
        )}
        {status !== "storniert" && (
          <button
            type="button"
            onClick={async () => {
              if (await speichere()) setMailOffen(true);
            }}
            disabled={laeuft}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            ✉ {ueberfaellig ? "Zahlungserinnerung senden" : "Per E-Mail senden"}
          </button>
        )}
        {status === "entwurf" && (
          <button
            type="button"
            onClick={async () => {
              if (
                !confirm(
                  "Rechnung als versendet markieren? Danach ist sie nicht mehr änderbar (z. B. wenn sie ausgedruckt übergeben wird)."
                )
              ) {
                return;
              }
              if (!(await speichere())) return;
              const ergebnis = await setzeRechnungStatus(rechnung.id, "versendet");
              if (ergebnis.ok) setStatus("versendet");
              else setFehler(ergebnis.fehler);
            }}
            disabled={laeuft}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Als versendet markieren
          </button>
        )}
        {status === "versendet" && (
          <button
            type="button"
            onClick={() => handleBezahlt(true)}
            className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
          >
            ✓ Als bezahlt markieren
          </button>
        )}
        {status === "bezahlt" && (
          <button
            type="button"
            onClick={() => handleBezahlt(false)}
            className="text-sm text-slate-500 underline hover:text-slate-900"
          >
            Zahlung zurücknehmen
          </button>
        )}
        {gesperrt && status !== "storniert" && !rechnung.storno_von && (
          <button
            type="button"
            onClick={handleStorno}
            className="text-sm text-red-600 underline hover:text-red-800"
          >
            Stornieren
          </button>
        )}
        {!gesperrt && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Entwurf ${rechnung.nummer} wirklich löschen?`)) {
                loescheRechnung(rechnung.id).then((ergebnis) => {
                  if (ergebnis && !ergebnis.ok) setFehler(ergebnis.fehler);
                });
              }
            }}
            className="ml-auto text-sm text-red-600 underline hover:text-red-800"
          >
            Entwurf löschen
          </button>
        )}
      </div>

      {meldung && <p className="text-sm text-green-700">{meldung}</p>}
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      {/* Gagenverteilung erst, wenn Geld da ist - vorher fehlt die Grundlage. */}
      {(status === "bezahlt" || anteile.length > 0) && (
        <GagenPanel
          rechnungId={rechnung.id}
          gesamtbetrag={summen.brutto}
          mitglieder={mitglieder}
          anteile={anteile}
        />
      )}

      {mailOffen && (
        <AngebotMailDialog
          modus="rechnung"
          angebotId={rechnung.id}
          bandId={rechnung.band_id}
          bandName={rechnung.band.name}
          nummer={rechnung.nummer}
          titel={form.titel}
          venueId={venueId}
          empfaengerName={form.empfaengerName}
          empfaengerOrt={form.empfaengerOrt || null}
          ansprechpartner={form.empfaengerAnsprechpartner || null}
          emailVorschlag={venueEmail}
          vorlagen={vorlagen}
          dokumentTypen={dokumentTypen}
          pdfPfad={rechnung.pdf_pfad}
          pdfDateiname={pdfDateiname}
          onGesendet={() => {
            setMailOffen(false);
            setStatus("versendet");
            setMeldung("Rechnung wurde versendet.");
          }}
          onSchliessen={() => setMailOffen(false)}
        />
      )}
    </div>
  );
}
