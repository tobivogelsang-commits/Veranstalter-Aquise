"use client";

import { useState } from "react";
import { HtmlEditor } from "@/components/HtmlEditor";
import { ladeEmailAnhangHoch, sendeEmail } from "@/lib/emailActions";
import { setzeAngebotStatus } from "@/lib/angebotActions";
import type { EmailAnhang } from "@/lib/database.types";
import type { BandDokumentTypMitUrl, EmailVorlage } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

// Platzhalter wie im E-Mail-Bereich beim Veranstalter, damit dieselben
// Vorlagen hier funktionieren.
function ersetzePlatzhalter(
  text: string,
  empfaenger: string,
  ort: string | null,
  ansprechpartner: string | null,
  bandName: string
): string {
  return text
    .replaceAll("{{veranstalter}}", empfaenger)
    .replaceAll("{{ort}}", ort ?? "")
    .replaceAll("{{ansprechpartner}}", ansprechpartner ?? "")
    .replaceAll("{{band}}", bandName);
}

// Ohne Vorlage: höfliche Standardanrede. Ist ein Ansprechpartner bekannt, wird
// er namentlich angesprochen - die Anrede (Herr/Frau) lässt sich nicht sicher
// ableiten, deshalb bleibt sie zum Anpassen stehen.
function standardText(ansprechpartner: string | null, bandName: string): string {
  const anrede = ansprechpartner
    ? `Sehr geehrte/r Frau/Herr ${ansprechpartner},`
    : "Sehr geehrte Damen und Herren,";
  return [
    `<p>${anrede}</p>`,
    "<p>vielen Dank für Ihr Interesse. Im Anhang finden Sie unser Angebot.</p>",
    "<p>Für Rückfragen stehen wir gerne zur Verfügung.</p>",
    `<p>Mit freundlichen Grüßen<br>${bandName}</p>`,
  ].join("");
}

// Versand des Angebots direkt aus der Angebots-Maske: Empfänger, Betreff und
// Anrede sind vorbereitet, das PDF hängt automatisch an. Nach dem Senden wird
// das Angebot auf "Versendet" gesetzt.
export function AngebotMailDialog({
  angebotId,
  bandId,
  bandName,
  nummer,
  titel,
  venueId,
  empfaengerName,
  empfaengerOrt,
  ansprechpartner,
  emailVorschlag,
  vorlagen,
  dokumentTypen,
  pdfPfad,
  pdfDateiname,
  onGesendet,
  onSchliessen,
}: {
  angebotId: string;
  bandId: string;
  bandName: string;
  nummer: string;
  titel: string;
  venueId: string | null;
  empfaengerName: string;
  empfaengerOrt: string | null;
  ansprechpartner: string | null;
  emailVorschlag: string | null;
  vorlagen: EmailVorlage[];
  // In den Band-Einstellungen hinterlegte Dateien (Stage Rider etc.).
  dokumentTypen: BandDokumentTypMitUrl[];
  pdfPfad: string | null;
  pdfDateiname: string | null;
  onGesendet: () => void;
  onSchliessen: () => void;
}) {
  const [an, setAn] = useState(emailVorschlag ?? "");
  const [betreff, setBetreff] = useState(`${titel} ${nummer} – ${bandName}`);
  const [inhalt, setInhalt] = useState(() => standardText(ansprechpartner, bandName));
  // Der Editor übernimmt seinen Startwert nur beim Mounten - für einen
  // Vorlagenwechsel erzwingt ein neuer Schlüssel den Neuaufbau.
  const [editorKey, setEditorKey] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Zusätzlich zum Angebots-PDF, das immer mitgeht.
  const [anhaenge, setAnhaenge] = useState<EmailAnhang[]>([]);
  const [anhangLaeuft, setAnhangLaeuft] = useState(false);

  const dokumenteMitDatei = dokumentTypen.filter((t) => t.datei_pfad && t.dateiname);

  function handleDokumentAnhaengen(typ: BandDokumentTypMitUrl) {
    if (!typ.datei_pfad || !typ.dateiname) return;
    if (anhaenge.some((a) => a.pfad === typ.datei_pfad)) return;
    setAnhaenge((prev) => [
      ...prev,
      { dateiname: typ.dateiname!, pfad: typ.datei_pfad! },
    ]);
  }

  async function handleAnhangAuswahl(e: React.ChangeEvent<HTMLInputElement>) {
    const dateien = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (dateien.length === 0) return;

    setAnhangLaeuft(true);
    for (const datei of dateien) {
      const formData = new FormData();
      formData.set("datei", datei);
      const ergebnis = await ladeEmailAnhangHoch(bandId, formData);
      if (ergebnis.ok) {
        setAnhaenge((prev) => [
          ...prev,
          { dateiname: ergebnis.dateiname, pfad: ergebnis.pfad },
        ]);
      } else {
        setFehler(ergebnis.fehler);
      }
    }
    setAnhangLaeuft(false);
  }

  function handleVorlage(vorlageId: string) {
    const vorlage = vorlagen.find((v) => v.id === vorlageId);
    if (!vorlage) return;
    setBetreff(
      ersetzePlatzhalter(vorlage.betreff, empfaengerName, empfaengerOrt, ansprechpartner, bandName)
    );
    setInhalt(
      ersetzePlatzhalter(vorlage.inhalt, empfaengerName, empfaengerOrt, ansprechpartner, bandName)
    );
    setEditorKey((k) => k + 1);
  }

  async function handleSenden() {
    if (!an.trim() || laeuft) return;
    setLaeuft(true);
    setFehler(null);

    // Angebots-PDF zuerst, dann die übrigen Anhänge.
    const alleAnhaenge: EmailAnhang[] = [
      ...(pdfPfad && pdfDateiname ? [{ dateiname: pdfDateiname, pfad: pdfPfad }] : []),
      ...anhaenge,
    ];

    const ergebnis = await sendeEmail(bandId, an, betreff, inhalt, venueId, alleAnhaenge);
    if (!ergebnis.ok) {
      setLaeuft(false);
      setFehler(ergebnis.fehler);
      return;
    }

    await setzeAngebotStatus(angebotId, "versendet");
    setLaeuft(false);
    onGesendet();
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/30 p-4"
      onClick={onSchliessen}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-lg bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Angebot per E-Mail senden
          </h2>
          <button
            type="button"
            onClick={onSchliessen}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {vorlagen.length > 0 && (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Vorlage verwenden
              <select
                defaultValue=""
                onChange={(e) => e.target.value && handleVorlage(e.target.value)}
                className={inputClass}
              >
                <option value="">– Vorlage wählen –</option>
                {vorlagen.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            An
            <input
              value={an}
              onChange={(e) => setAn(e.target.value)}
              placeholder="empfaenger@example.de"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Betreff
            <input
              value={betreff}
              onChange={(e) => setBetreff(e.target.value)}
              className={inputClass}
            />
          </label>

          <div className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Nachricht
            <HtmlEditor key={editorKey} defaultValue={inhalt} onChange={setInhalt} />
          </div>

          <div className="flex flex-col gap-2 rounded-md bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-600">
              {pdfDateiname ? (
                <>📎 {pdfDateiname} hängt automatisch an.</>
              ) : (
                <>
                  Noch kein PDF erzeugt – bitte zuerst „PDF erzeugen &amp; ansehen“
                  klicken, sonst geht die Mail ohne Angebot raus.
                </>
              )}
            </p>

            {anhaenge.length > 0 && (
              <ul className="flex flex-col gap-1">
                {anhaenge.map((a) => (
                  <li key={a.pfad} className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="min-w-0 flex-1 truncate">📎 {a.dateiname}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAnhaenge((prev) => prev.filter((x) => x.pfad !== a.pfad))
                      }
                      className="shrink-0 text-slate-400 hover:text-red-600"
                      title="Anhang entfernen"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {dokumenteMitDatei.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dokumenteMitDatei.map((typ) => (
                  <button
                    key={typ.id}
                    type="button"
                    onClick={() => handleDokumentAnhaengen(typ)}
                    disabled={anhaenge.some((a) => a.pfad === typ.datei_pfad)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    + {typ.name}
                  </button>
                ))}
              </div>
            )}

            <label className="w-fit cursor-pointer text-xs font-medium text-slate-600 underline hover:text-slate-900">
              {anhangLaeuft ? "Lädt hoch…" : "+ Anhang hinzufügen"}
              <input
                type="file"
                multiple
                disabled={anhangLaeuft}
                onChange={handleAnhangAuswahl}
                className="hidden"
              />
            </label>
          </div>

          {fehler && <p className="text-sm text-red-600">{fehler}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onSchliessen}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSenden}
              disabled={laeuft || !an.trim()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {laeuft ? "Wird gesendet…" : "Senden"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
