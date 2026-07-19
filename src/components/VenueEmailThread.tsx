"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import clsx from "clsx";
import { ladeEmailAnhangHoch, sendeEmail } from "@/lib/emailActions";
import type { EmailAnhang } from "@/lib/database.types";
import { HtmlEditor } from "@/components/HtmlEditor";
import type { BandDokumentTyp, EmailVorlage, VenueEmailMitBand } from "@/lib/types";

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

function ersetzePlatzhalter(
  text: string,
  venueName: string,
  venueOrt: string | null,
  ansprechpartner: string | null,
  bandName: string
): string {
  return text
    .replaceAll("{{veranstalter}}", venueName)
    .replaceAll("{{ort}}", venueOrt ?? "")
    .replaceAll("{{ansprechpartner}}", ansprechpartner ?? "")
    .replaceAll("{{band}}", bandName);
}

// Compose-Formular + chronologischer Konversations-Thread für eine
// Band<->Veranstalter-Kombination. Bewusst ein einziger Thread statt
// Eingang/Ausgang-Ordnern (wie auf der E-Mails-Seite) - hier geht es um
// die eine Konversation mit diesem einen Veranstalter, die als Ganzes
// erkennbar sein soll.
export function VenueEmailThread({
  bandId,
  bandName,
  venueId,
  venueName,
  venueOrt,
  venueAnsprechpartner,
  venueEmail,
  vorlagen,
  emails,
  dokumentTypen,
}: {
  bandId: string;
  bandName: string;
  venueId: string;
  venueName: string;
  venueOrt: string | null;
  venueAnsprechpartner: string | null;
  venueEmail: string | null;
  vorlagen: EmailVorlage[];
  emails: VenueEmailMitBand[];
  dokumentTypen: BandDokumentTyp[];
}) {
  const router = useRouter();

  const [an, setAn] = useState(venueEmail ?? "");
  const [vorlageId, setVorlageId] = useState("");
  const [betreff, setBetreff] = useState("");
  // inhaltSeed/-Ref: siehe HtmlEditor - defaultValue nur an Reset-Punkten
  // setzen, sonst springt der Cursor bei jedem Tastendruck an den Anfang
  // zurück (Text erscheint dann rückwärts).
  const [inhaltSeed, setInhaltSeed] = useState("");
  const inhaltRef = useRef("");
  const [editorKey, setEditorKey] = useState(0);
  const [anhaenge, setAnhaenge] = useState<EmailAnhang[]>([]);
  const [anhangLaeuft, setAnhangLaeuft] = useState(false);
  const [sendenLaeuft, setSendenLaeuft] = useState(false);
  const [sendenFehler, setSendenFehler] = useState<string | null>(null);

  function handleVorlageAuswahl(id: string) {
    setVorlageId(id);
    if (!id) return;
    const vorlage = vorlagen.find((v) => v.id === id);
    if (!vorlage) return;
    setBetreff(
      ersetzePlatzhalter(vorlage.betreff, venueName, venueOrt, venueAnsprechpartner, bandName)
    );
    const neuerInhalt = ersetzePlatzhalter(
      vorlage.inhalt,
      venueName,
      venueOrt,
      venueAnsprechpartner,
      bandName
    );
    inhaltRef.current = neuerInhalt;
    setInhaltSeed(neuerInhalt);
    setEditorKey((k) => k + 1);
  }

  async function handleBildHochladen(datei: File): Promise<string | null> {
    const formData = new FormData();
    formData.set("datei", datei);
    const ergebnis = await ladeEmailAnhangHoch(bandId, formData);
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
          { dateiname: ergebnis.dateiname, url: ergebnis.url },
        ]);
      }
    }
    setAnhangLaeuft(false);
  }

  function handleAnhangEntfernen(url: string) {
    setAnhaenge((prev) => prev.filter((a) => a.url !== url));
  }

  // Hängt eine in den Band-Einstellungen hinterlegte Datei (Stage Rider,
  // Angebot etc.) direkt an, ohne sie erneut hochzuladen.
  function handleDokumentAnhaengen(typ: BandDokumentTyp) {
    if (!typ.datei_url || !typ.dateiname) return;
    if (anhaenge.some((a) => a.url === typ.datei_url)) return;
    setAnhaenge((prev) => [
      ...prev,
      { dateiname: typ.dateiname!, url: typ.datei_url! },
    ]);
  }

  const dokumenteMitDatei = dokumentTypen.filter((t) => t.datei_url);

  async function handleSenden() {
    if (!an.trim() || !betreff.trim()) {
      setSendenFehler("An und Betreff sind Pflichtfelder.");
      return;
    }
    setSendenLaeuft(true);
    setSendenFehler(null);
    const ergebnis = await sendeEmail(
      bandId,
      an,
      betreff,
      inhaltRef.current,
      venueId,
      anhaenge
    );
    setSendenLaeuft(false);
    if (!ergebnis.ok) {
      setSendenFehler(ergebnis.fehler);
      return;
    }
    setVorlageId("");
    setBetreff("");
    inhaltRef.current = "";
    setInhaltSeed("");
    setEditorKey((k) => k + 1);
    setAnhaenge([]);
    router.refresh();
  }

  const thread = [...emails].sort((a, b) =>
    a.zeitpunkt.localeCompare(b.zeitpunkt)
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Kein <form> hier - diese Komponente steckt im Band-Zuordnung-Bereich
          innerhalb des großen Veranstalter-Speichern-Formulars, verschachtelte
          <form>-Elemente sind ungültiges HTML und lassen die Seite beim
          Hydrieren abstürzen. Versand läuft daher über einen Button-Klick
          statt onSubmit, "required" wird manuell in handleSenden geprüft. */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3">
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
            type="email"
            value={an}
            onChange={(e) => setAn(e.target.value)}
            placeholder="veranstalter@beispiel.de"
            className={inputClass}
          />
        </Field>
        <Field label="Betreff">
          <input
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
          {dokumenteMitDatei.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {dokumenteMitDatei.map((typ) => (
                <button
                  key={typ.id}
                  type="button"
                  onClick={() => handleDokumentAnhaengen(typ)}
                  disabled={anhaenge.some((a) => a.url === typ.datei_url)}
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
          {anhaenge.length > 0 && (
            <ul className="flex flex-col gap-1">
              {anhaenge.map((a) => (
                <li
                  key={a.url}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  📎 {a.dateiname}
                  <button
                    type="button"
                    onClick={() => handleAnhangEntfernen(a.url)}
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
          {sendenFehler && <p className="text-sm text-red-600">{sendenFehler}</p>}
          <div className="ml-auto">
            <button
              type="button"
              disabled={sendenLaeuft}
              onClick={handleSenden}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {sendenLaeuft ? "Wird gesendet…" : "E-Mail versenden"}
            </button>
          </div>
        </div>
      </div>

      {thread.length === 0 ? (
        <p className="text-sm text-slate-500">
          Noch keine E-Mails mit diesem Veranstalter ({bandName}).
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {thread.map((mail) => (
            <div
              key={mail.id}
              className={clsx(
                "rounded-lg border p-3 text-sm",
                mail.richtung === "gesendet"
                  ? "ml-6 border-slate-200 bg-slate-50"
                  : "mr-6 border-sky-200 bg-sky-50"
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  {mail.richtung === "gesendet" ? `An: ${mail.an}` : `Von: ${mail.von}`}
                </span>
                <span className="shrink-0">
                  {format(new Date(mail.zeitpunkt), "dd.MM.yyyy HH:mm")}
                </span>
              </div>
              <p className="mb-1 font-medium text-slate-900">
                {mail.betreff || "(kein Betreff)"}
              </p>
              {mail.richtung === "gesendet" ? (
                <div
                  className="text-slate-700 [&_img]:my-2 [&_img]:max-w-full"
                  dangerouslySetInnerHTML={{
                    __html: mail.text_inhalt || "(kein Inhalt)",
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap text-slate-700">
                  {mail.text_inhalt || "(kein Inhalt)"}
                </p>
              )}
              {mail.anhaenge && mail.anhaenge.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-200/70 pt-2">
                  {mail.anhaenge.map((a) => (
                    <a
                      key={a.url}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
                    >
                      📎 {a.dateiname}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
