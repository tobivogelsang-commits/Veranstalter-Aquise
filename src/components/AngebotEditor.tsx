"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  aktualisiereAngebot,
  erzeugeAngebotPdfDatei,
  loescheAngebot,
  setzeAngebotStatus,
} from "@/lib/angebotActions";
import { berechneAngebotSummen, formatEuro } from "@/lib/angebotHelpers";
import { AngebotMailDialog } from "@/components/AngebotMailDialog";
import type {
  AngebotBausteinFeld,
  AngebotPosition,
  AngebotStatus,
} from "@/lib/database.types";
import type {
  AngebotBaustein,
  AngebotMitBand,
  BandDokumentTypMitUrl,
  EmailVorlage,
} from "@/lib/types";
import type { VenueVorschlag } from "@/lib/queries";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

const STATUS_LABEL: Record<AngebotStatus, string> = {
  entwurf: "Entwurf",
  versendet: "Versendet",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
};

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      {children}
    </label>
  );
}

// Auswahl eines Textbausteins für ein Feld. Bewusst außerhalb der
// Editor-Komponente definiert: Eine im Render erzeugte Komponente würde bei
// jedem Tastendruck neu aufgebaut und verlöre dabei Fokus und Zustand.
function BausteinAuswahl({
  bausteine,
  feld,
  onWaehlen,
}: {
  bausteine: AngebotBaustein[];
  feld: AngebotBausteinFeld;
  onWaehlen: (text: string) => void;
}) {
  const passende = bausteine.filter((b) => b.feld === feld);
  if (passende.length === 0) return null;

  return (
    <select
      value=""
      onChange={(e) => {
        const baustein = passende.find((b) => b.id === e.target.value);
        if (baustein) onWaehlen(baustein.text);
      }}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 focus:border-slate-500 focus:outline-none"
      title="Textbaustein einsetzen"
    >
      <option value="">Baustein…</option>
      {passende.map((b) => (
        <option key={b.id} value={b.id}>
          {b.titel}
        </option>
      ))}
    </select>
  );
}

// Angebots-Maske: Empfänger, Texte und Positionen. Gespeichert wird per Klick
// (kein Autosave), danach lässt sich das PDF erzeugen und ansehen.
export function AngebotEditor({
  angebot,
  venues,
  vorlagen,
  dokumentTypen,
  bausteine,
}: {
  angebot: AngebotMitBand;
  venues: VenueVorschlag[];
  vorlagen: EmailVorlage[];
  dokumentTypen: BandDokumentTypMitUrl[];
  bausteine: AngebotBaustein[];
}) {
  const [form, setForm] = useState({
    titel: angebot.titel,
    datum: angebot.datum,
    gueltigBis: angebot.gueltig_bis ?? "",
    empfaengerName: angebot.empfaenger_name,
    empfaengerAnsprechpartner: angebot.empfaenger_ansprechpartner ?? "",
    empfaengerStrasse: angebot.empfaenger_strasse ?? "",
    empfaengerPlz: angebot.empfaenger_plz ?? "",
    empfaengerOrt: angebot.empfaenger_ort ?? "",
    einleitung: angebot.einleitung ?? "",
    zahlungsbedingungen: angebot.zahlungsbedingungen ?? "",
    nachbemerkung: angebot.nachbemerkung ?? "",
    ustSatz: angebot.ust_satz,
  });
  const [positionen, setPositionen] = useState<AngebotPosition[]>(
    angebot.positionen.length > 0 ? angebot.positionen : [{ beschreibung: "", betrag: 0 }]
  );
  const [venueId, setVenueId] = useState<string | null>(angebot.venue_id);
  // E-Mail des gewählten Veranstalters (nur für den Versand-Dialog, nicht
  // Teil des Angebots selbst).
  const [venueEmail, setVenueEmail] = useState<string | null>(
    venues.find((v) => v.id === angebot.venue_id)?.email ?? null
  );
  const [zeigeVorschlaege, setZeigeVorschlaege] = useState(false);
  const [mailOffen, setMailOffen] = useState(false);
  const [status, setStatus] = useState<AngebotStatus>(angebot.status);
  const [pdfDateiname, setPdfDateiname] = useState<string | null>(angebot.pdf_dateiname);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const summen = berechneAngebotSummen(positionen, form.ustSatz);


  // Vorschläge: Veranstalter, deren Name den Eingabetext enthält. Erst ab dem
  // ersten Zeichen, damit die Liste nicht ungefragt aufspringt.
  const treffer =
    form.empfaengerName.trim().length > 0
      ? venues
          .filter((v) =>
            v.name.toLowerCase().includes(form.empfaengerName.trim().toLowerCase())
          )
          .slice(0, 8)
      : [];

  // Übernimmt Anschrift und Ansprechpartner und verknüpft das Angebot mit dem
  // Veranstalter - dadurch taucht es dort auf und lässt sich an dessen Mails
  // anhängen.
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
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);
    const ergebnis = await aktualisiereAngebot(angebot.id, {
      titel: form.titel,
      datum: form.datum,
      gueltigBis: form.gueltigBis || null,
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

  // Erst speichern, dann erzeugen - sonst landet ein veralteter Stand im PDF.
  async function handlePdf() {
    if (!(await speichere())) return;
    setLaeuft(true);
    const ergebnis = await erzeugeAngebotPdfDatei(angebot.id);
    setLaeuft(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    setPdfDateiname(ergebnis.dateiname);
    setMeldung("PDF erzeugt.");
    window.open(`/api/angebot/${angebot.id}/pdf`, "_blank");
  }

  async function handleStatus(neu: AngebotStatus) {
    setStatus(neu);
    const ergebnis = await setzeAngebotStatus(angebot.id, neu);
    if (!ergebnis.ok) setFehler(ergebnis.fehler);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {angebot.nummer}
        </span>
        <select
          value={status}
          onChange={(e) => handleStatus(e.target.value as AngebotStatus)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          {(Object.keys(STATUS_LABEL) as AngebotStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{angebot.band.name}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium text-slate-900">Empfänger</h2>
          <Feld label="Name">
            <div className="relative">
              <input
                value={form.empfaengerName}
                onChange={(e) => {
                  setForm((p) => ({ ...p, empfaengerName: e.target.value }));
                  setZeigeVorschlaege(true);
                  // Tippt jemand den Namen frei um, ist die Verknüpfung zum
                  // Veranstalter nicht mehr gesichert.
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
                        // onMouseDown feuert vor dem Blur des Feldes.
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
            {venueId && (
              <span className="text-xs font-normal text-green-700">
                ✓ mit dem Veranstalter verknüpft – das Angebot erscheint dort
              </span>
            )}
          </Feld>
          <Feld label="Ansprechpartner">
            <input
              value={form.empfaengerAnsprechpartner}
              onChange={(e) =>
                setForm((p) => ({ ...p, empfaengerAnsprechpartner: e.target.value }))
              }
              className={inputClass}
            />
          </Feld>
          <Feld label="Straße & Hausnummer">
            <input
              value={form.empfaengerStrasse}
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
                onChange={(e) => setForm((p) => ({ ...p, empfaengerPlz: e.target.value }))}
                className={inputClass}
              />
            </Feld>
            <div className="col-span-2">
              <Feld label="Ort">
                <input
                  value={form.empfaengerOrt}
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
          <Feld label="Belegtitel">
            <input
              value={form.titel}
              onChange={(e) => setForm((p) => ({ ...p, titel: e.target.value }))}
              className={inputClass}
            />
          </Feld>
          <div className="grid grid-cols-2 gap-2">
            <Feld label="Datum">
              <input
                type="date"
                value={form.datum}
                onChange={(e) => setForm((p) => ({ ...p, datum: e.target.value }))}
                className={inputClass}
              />
            </Feld>
            <Feld label="Gültig bis">
              <input
                type="date"
                value={form.gueltigBis}
                onChange={(e) => setForm((p) => ({ ...p, gueltigBis: e.target.value }))}
                className={inputClass}
              />
            </Feld>
          </div>
          <Feld label="Umsatzsteuer">
            <select
              value={String(form.ustSatz)}
              onChange={(e) => setForm((p) => ({ ...p, ustSatz: Number(e.target.value) }))}
              className={inputClass}
            >
              <option value="0">Keine (§ 19 UStG)</option>
              <option value="7">7 % (ermäßigt)</option>
              <option value="19">19 %</option>
            </select>
          </Feld>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-slate-900">Einleitung</h2>
          <BausteinAuswahl
              bausteine={bausteine}
              feld="einleitung"
              onWaehlen={(text) => setForm((p) => ({ ...p, einleitung: text }))}
            />
        </div>
        <textarea
          value={form.einleitung}
          onChange={(e) => setForm((p) => ({ ...p, einleitung: e.target.value }))}
          rows={2}
          placeholder="gerne unterbreiten wir Ihnen folgendes Angebot:"
          className={inputClass}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-900">Leistungen</h2>
        <div className="flex flex-col gap-2">
          {positionen.map((position, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-xs text-slate-400">{i + 1}</span>
                <textarea
                  value={position.beschreibung}
                  onChange={(e) => setzePosition(i, { beschreibung: e.target.value })}
                  rows={2}
                  placeholder="z. B. Live-Auftritt 2 x 45 Minuten inkl. Anlage und Licht"
                  className={inputClass}
                />
                <input
                  type="number"
                  step="0.01"
                  value={position.betrag || ""}
                  onChange={(e) => setzePosition(i, { betrag: Number(e.target.value) })}
                  placeholder="0,00"
                  className={clsx(
                    "w-32 shrink-0 rounded-md border px-3 py-2 text-right text-sm focus:outline-none",
                    position.optional
                      ? "border-slate-300 bg-slate-50 text-slate-500 focus:border-slate-400"
                      : "border-slate-300 focus:border-slate-500"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setPositionen((prev) => prev.filter((_, x) => x !== i))}
                  className="mt-2 shrink-0 text-slate-300 hover:text-red-600"
                  title="Position entfernen"
                >
                  ×
                </button>
              </div>
              <label className="ml-7 flex w-fit items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={Boolean(position.optional)}
                  onChange={(e) => setzePosition(i, { optional: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                Eventualposition – Preis wird ausgewiesen, zählt aber nicht zum
                Gesamtbetrag
              </label>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setPositionen((prev) => [...prev, { beschreibung: "", betrag: 0 }])
          }
          className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          + Position
        </button>

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
                <span>Gesamtbetrag</span>
                <span className="w-28 text-right">{formatEuro(summen.brutto)}</span>
              </div>
            </>
          ) : (
            <div className="flex gap-6 font-semibold">
              <span>Gesamtbetrag</span>
              <span className="w-28 text-right">{formatEuro(summen.netto)}</span>
            </div>
          )}
          {summen.hatEventualpositionen && (
            <p className="mt-1 text-xs text-slate-500">
              Eventualpositionen sind nicht enthalten.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-900">Zahlungsbedingungen</h2>
            <BausteinAuswahl
              bausteine={bausteine}
              feld="zahlungsbedingungen"
              onWaehlen={(text) => setForm((p) => ({ ...p, zahlungsbedingungen: text }))}
            />
          </div>
          <textarea
            value={form.zahlungsbedingungen}
            onChange={(e) =>
              setForm((p) => ({ ...p, zahlungsbedingungen: e.target.value }))
            }
            rows={2}
            className={inputClass}
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-900">Nachbemerkung</h2>
            <BausteinAuswahl
              bausteine={bausteine}
              feld="nachbemerkung"
              onWaehlen={(text) => setForm((p) => ({ ...p, nachbemerkung: text }))}
            />
          </div>
          <textarea
            value={form.nachbemerkung}
            onChange={(e) => setForm((p) => ({ ...p, nachbemerkung: e.target.value }))}
            rows={3}
            placeholder="z. B. Hinweise zu Technik, Anfahrt oder Gültigkeit des Angebots"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSpeichern}
          disabled={laeuft}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Speichern
        </button>
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
            href={`/api/angebot/${angebot.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            {pdfDateiname}
          </a>
        )}
        <button
          type="button"
          onClick={async () => {
            // Vor dem Versand speichern, damit Empfänger und Texte im Dialog
            // zum aktuellen Stand passen.
            if (await speichere()) setMailOffen(true);
          }}
          disabled={laeuft}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          ✉ Per E-Mail senden
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Angebot ${angebot.nummer} wirklich löschen?`)) {
              loescheAngebot(angebot.id);
            }
          }}
          className="ml-auto text-sm text-red-600 underline hover:text-red-800"
        >
          Angebot löschen
        </button>
      </div>

      {meldung && <p className="text-sm text-green-700">{meldung}</p>}
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      {mailOffen && (
        <AngebotMailDialog
          angebotId={angebot.id}
          bandId={angebot.band_id}
          bandName={angebot.band.name}
          nummer={angebot.nummer}
          titel={form.titel}
          venueId={venueId}
          empfaengerName={form.empfaengerName}
          empfaengerOrt={form.empfaengerOrt || null}
          ansprechpartner={form.empfaengerAnsprechpartner || null}
          emailVorschlag={venueEmail}
          vorlagen={vorlagen}
          dokumentTypen={dokumentTypen}
          pdfPfad={angebot.pdf_pfad}
          pdfDateiname={pdfDateiname}
          onGesendet={() => {
            setMailOffen(false);
            setStatus("versendet");
            setMeldung("Angebot wurde versendet.");
          }}
          onSchliessen={() => setMailOffen(false)}
        />
      )}
    </div>
  );
}
