"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ladeEmailAnhangHoch,
  ladeInlineBildHoch,
  sendeEmail,
} from "@/lib/emailActions";
import type { EmailAnhang } from "@/lib/database.types";
import { EmailVerlauf } from "@/components/EmailVerlauf";
import { HtmlEditor } from "@/components/HtmlEditor";
import type { BandEmailMitVenue, BandVenueOption, EmailVorlage } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

// Ersetzt {{veranstalter}}, {{ort}}, {{ansprechpartner}}, {{band}} durch die
// Daten des aktuell im Compose-Formular ausgewählten Veranstalters/der Band -
// einmalig beim Auswählen der Vorlage, nicht laufend aktualisiert.
function ersetzePlatzhalter(
  text: string,
  venue: BandVenueOption | undefined,
  bandName: string
): string {
  return text
    .replaceAll("{{veranstalter}}", venue?.name ?? "")
    .replaceAll("{{ort}}", venue?.ort ?? "")
    .replaceAll("{{ansprechpartner}}", venue?.ansprechpartner ?? "")
    .replaceAll("{{band}}", bandName);
}

export function BandEmailSection({
  bandId,
  bandName,
  emails,
  venues,
  vorausgewaehlteVenueId,
  vorlagen,
}: {
  bandId: string;
  bandName: string;
  emails: BandEmailMitVenue[];
  venues: BandVenueOption[];
  vorausgewaehlteVenueId?: string;
  vorlagen: EmailVorlage[];
}) {
  const router = useRouter();

  const vorausgewaehlterVenue = venues.find(
    (v) => v.id === vorausgewaehlteVenueId
  );

  const [venueId, setVenueId] = useState(vorausgewaehlteVenueId ?? "");
  const [an, setAn] = useState(vorausgewaehlterVenue?.email ?? "");
  const [vorlageId, setVorlageId] = useState("");
  const [betreff, setBetreff] = useState("");
  // inhaltSeed (State) geht als defaultValue an HtmlEditor und wird nur an
  // den Reset-Punkten (Vorlage wählen, nach Senden) gesetzt - nie bei jedem
  // Tastendruck. inhaltRef verfolgt den aktuellen Wert für den Versand
  // (Refs dürfen laut React nicht beim Rendern gelesen werden, nur in
  // Event-Handlern). Würde stattdessen der bei jedem Tastendruck
  // aktualisierte Wert direkt als defaultValue durchgereicht, würde React
  // dessen dangerouslySetInnerHTML bei jedem Tastendruck neu anwenden und
  // den Cursor an den Anfang zurücksetzen (Text erscheint dann rückwärts,
  // da jedes neue Zeichen wieder vorne landet).
  const [inhaltSeed, setInhaltSeed] = useState("");
  const inhaltRef = useRef("");
  const [editorKey, setEditorKey] = useState(0);
  const [anhaenge, setAnhaenge] = useState<EmailAnhang[]>([]);
  const [anhangLaeuft, setAnhangLaeuft] = useState(false);
  const [sendenLaeuft, setSendenLaeuft] = useState(false);
  const [sendenFehler, setSendenFehler] = useState<string | null>(null);

  function handleVenueAuswahl(id: string) {
    setVenueId(id);
    const gewaehlt = venues.find((v) => v.id === id);
    if (gewaehlt?.email) setAn(gewaehlt.email);
  }

  function handleVorlageAuswahl(id: string) {
    setVorlageId(id);
    if (!id) return;
    const vorlage = vorlagen.find((v) => v.id === id);
    if (!vorlage) return;
    const venue = venues.find((v) => v.id === venueId);
    setBetreff(ersetzePlatzhalter(vorlage.betreff, venue, bandName));
    const neuerInhalt = ersetzePlatzhalter(vorlage.inhalt, venue, bandName);
    inhaltRef.current = neuerInhalt;
    setInhaltSeed(neuerInhalt);
    setEditorKey((k) => k + 1);
  }

  async function handleBildHochladen(datei: File): Promise<string | null> {
    const formData = new FormData();
    formData.set("datei", datei);
    // Inline-Bild -> öffentlicher Bucket, damit es im Mailprogramm des
    // Empfängers auch später noch lädt.
    const ergebnis = await ladeInlineBildHoch(bandId, formData);
    return ergebnis.ok ? ergebnis.url : null;
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
      }
    }
    setAnhangLaeuft(false);
  }

  function handleAnhangEntfernen(pfad: string) {
    setAnhaenge((prev) => prev.filter((a) => a.pfad !== pfad));
  }

  async function handleSenden(e: React.FormEvent) {
    e.preventDefault();
    setSendenLaeuft(true);
    setSendenFehler(null);
    const ergebnis = await sendeEmail(
      bandId,
      an,
      betreff,
      inhaltRef.current,
      venueId || null,
      anhaenge
    );
    setSendenLaeuft(false);
    if (!ergebnis.ok) {
      setSendenFehler(ergebnis.fehler);
      return;
    }
    setVenueId("");
    setAn("");
    setVorlageId("");
    setBetreff("");
    inhaltRef.current = "";
    setInhaltSeed("");
    setEditorKey((k) => k + 1);
    setAnhaenge([]);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSenden}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        {venues.length > 0 && (
          <Field label="Veranstalter (optional)">
            <select
              value={venueId}
              onChange={(e) => handleVenueAuswahl(e.target.value)}
              className={inputClass}
            >
              <option value="">— kein Veranstalter —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {vorlagen.length > 0 && (
          <Field label="Vorlage verwenden">
            <select
              value={vorlageId}
              onChange={(e) => handleVorlageAuswahl(e.target.value)}
              className={inputClass}
            >
              <option value="">— keine Vorlage —</option>
              {vorlagen.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="An">
          <input
            required
            type="email"
            value={an}
            onChange={(e) => setAn(e.target.value)}
            placeholder="veranstalter@beispiel.de"
            className={inputClass}
          />
        </Field>
        <Field label="Betreff">
          <input
            required
            value={betreff}
            onChange={(e) => setBetreff(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Nachricht">
          <HtmlEditor
            key={editorKey}
            defaultValue={inhaltSeed}
            onChange={(html) => {
              inhaltRef.current = html;
            }}
            onBildHochladen={handleBildHochladen}
          />
        </Field>
        <div className="flex flex-col gap-2">
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
          {anhaenge.length > 0 && (
            <ul className="flex flex-col gap-1">
              {anhaenge.map((a) => (
                <li
                  key={a.pfad}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  📎 {a.dateiname}
                  <button
                    type="button"
                    onClick={() => handleAnhangEntfernen(a.pfad)}
                    className="text-red-600 hover:text-red-800"
                  >
                    entfernen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          {sendenFehler && (
            <p className="text-sm text-red-600">{sendenFehler}</p>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={sendenLaeuft}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {sendenLaeuft ? "Wird gesendet…" : "E-Mail versenden"}
            </button>
          </div>
        </div>
      </form>

      <EmailVerlauf bandId={bandId} emails={emails} />
    </div>
  );
}
