"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ladeInlineBildHoch,
  loescheEmailVorlage,
  speichereEmailEinstellungen,
  speichereEmailVorlage,
} from "@/lib/emailActions";
import { HtmlEditor } from "@/components/HtmlEditor";
import type { EmailEinstellungenOhnePasswort, EmailVorlage } from "@/lib/types";

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

// Vorlagen-Verwaltung (anlegen/bearbeiten/löschen) und Mail-Zugangsdaten
// (SMTP/IMAP) einer Band - beides zusammen "Einstellungen", einzige Quelle
// für das, was beim Schreiben (auf der E-Mails- und Veranstalter-Seite)
// verfügbar ist.
export function EmailEinstellungenPanel({
  bandId,
  einstellungen,
  vorlagen,
}: {
  bandId: string;
  einstellungen: EmailEinstellungenOhnePasswort;
  vorlagen: EmailVorlage[];
}) {
  const router = useRouter();

  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  const [einstellungenLaeuft, setEinstellungenLaeuft] = useState(false);
  const [einstellungenFehler, setEinstellungenFehler] = useState<string | null>(
    null
  );
  const [einstellungenHinweis, setEinstellungenHinweis] = useState<
    string | null
  >(null);

  const [vorlagenOffen, setVorlagenOffen] = useState(false);
  const [bearbeiteteVorlageId, setBearbeiteteVorlageId] = useState<
    string | null
  >(null);
  const [neueVorlage, setNeueVorlage] = useState(false);
  const [vorlageName, setVorlageName] = useState("");
  const [vorlageBetreff, setVorlageBetreff] = useState("");
  // vorlageInhaltSeed/-Ref: siehe HtmlEditor - defaultValue nur an
  // Reset-Punkten setzen, sonst springt der Cursor bei jedem Tastendruck an
  // den Anfang zurück (Text erscheint dann rückwärts).
  const [vorlageInhaltSeed, setVorlageInhaltSeed] = useState("");
  const vorlageInhaltRef = useRef("");
  const [vorlageEditorKey, setVorlageEditorKey] = useState(0);
  const [vorlageSpeichertLaeuft, setVorlageSpeichertLaeuft] = useState(false);
  const [vorlageFehler, setVorlageFehler] = useState<string | null>(null);

  async function handleBildHochladen(datei: File): Promise<string | null> {
    const formData = new FormData();
    formData.set("datei", datei);
    const ergebnis = await ladeInlineBildHoch(bandId, formData);
    return ergebnis.ok ? ergebnis.url : null;
  }

  function handleVorlageBearbeiten(vorlage: EmailVorlage) {
    setBearbeiteteVorlageId(vorlage.id);
    setNeueVorlage(false);
    setVorlageName(vorlage.name);
    setVorlageBetreff(vorlage.betreff);
    vorlageInhaltRef.current = vorlage.inhalt;
    setVorlageInhaltSeed(vorlage.inhalt);
    setVorlageEditorKey((k) => k + 1);
    setVorlageFehler(null);
  }

  function handleVorlageNeu() {
    setBearbeiteteVorlageId(null);
    setNeueVorlage(true);
    setVorlageName("");
    setVorlageBetreff("");
    vorlageInhaltRef.current = "";
    setVorlageInhaltSeed("");
    setVorlageEditorKey((k) => k + 1);
    setVorlageFehler(null);
  }

  function handleVorlageAbbrechen() {
    setBearbeiteteVorlageId(null);
    setNeueVorlage(false);
    setVorlageFehler(null);
  }

  async function handleVorlageSpeichern(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setVorlageSpeichertLaeuft(true);
    setVorlageFehler(null);
    const formData = new FormData();
    formData.set("name", vorlageName);
    formData.set("betreff", vorlageBetreff);
    formData.set("inhalt", vorlageInhaltRef.current);
    const ergebnis = await speichereEmailVorlage(
      bandId,
      bearbeiteteVorlageId,
      formData
    );
    setVorlageSpeichertLaeuft(false);
    if (!ergebnis.ok) {
      setVorlageFehler(ergebnis.fehler);
      return;
    }
    setBearbeiteteVorlageId(null);
    setNeueVorlage(false);
    router.refresh();
  }

  async function handleVorlageLoeschen(id: string) {
    await loescheEmailVorlage(bandId, id);
    router.refresh();
  }

  async function handleEinstellungenSpeichern(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setEinstellungenLaeuft(true);
    setEinstellungenFehler(null);
    setEinstellungenHinweis(null);
    const formData = new FormData(e.currentTarget);
    const ergebnis = await speichereEmailEinstellungen(bandId, formData);
    setEinstellungenLaeuft(false);
    if (!ergebnis.ok) {
      setEinstellungenFehler(ergebnis.fehler);
      return;
    }
    setEinstellungenHinweis("Gespeichert.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-medium text-slate-900">E-Mail</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setVorlagenOffen((v) => !v)}
            className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
          >
            {vorlagenOffen ? "Vorlagen schließen" : "E-Mail-Vorlagen"}
          </button>
          <button
            type="button"
            onClick={() => setEinstellungenOffen((v) => !v)}
            className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
          >
            {einstellungenOffen
              ? "Einstellungen schließen"
              : "E-Mail-Einstellungen"}
          </button>
        </div>
      </div>

      {vorlagenOffen && (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {vorlagen.length === 0 && !neueVorlage && (
            <p className="text-sm text-slate-500">Noch keine Vorlagen.</p>
          )}
          {vorlagen.length > 0 && (
            <ul className="flex flex-col gap-2">
              {vorlagen.map((vorlage) => (
                <li
                  key={vorlage.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {vorlage.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {vorlage.betreff || "(kein Betreff)"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => handleVorlageBearbeiten(vorlage)}
                      className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVorlageLoeschen(vorlage.id)}
                      className="text-xs font-medium text-red-600 underline hover:text-red-800"
                    >
                      Löschen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!neueVorlage && !bearbeiteteVorlageId && (
            <button
              type="button"
              onClick={handleVorlageNeu}
              className="self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              + Neue Vorlage
            </button>
          )}

          {(neueVorlage || bearbeiteteVorlageId) && (
            <form
              onSubmit={handleVorlageSpeichern}
              className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3"
            >
              <p className="text-xs text-slate-500">
                Platzhalter: {"{{veranstalter}}"}, {"{{ort}}"},{" "}
                {"{{ansprechpartner}}"}, {"{{band}}"}
              </p>
              <Field label="Name">
                <input
                  required
                  value={vorlageName}
                  onChange={(e) => setVorlageName(e.target.value)}
                  placeholder="z. B. Erste Anfrage"
                  className={inputClass}
                />
              </Field>
              <Field label="Betreff">
                <input
                  value={vorlageBetreff}
                  onChange={(e) => setVorlageBetreff(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Inhalt">
                <HtmlEditor
                  key={vorlageEditorKey}
                  defaultValue={vorlageInhaltSeed}
                  onChange={(html) => {
                    vorlageInhaltRef.current = html;
                  }}
                  onBildHochladen={handleBildHochladen}
                />
              </Field>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={vorlageSpeichertLaeuft}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {vorlageSpeichertLaeuft ? "Speichert…" : "Vorlage speichern"}
                </button>
                <button
                  type="button"
                  onClick={handleVorlageAbbrechen}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Abbrechen
                </button>
                {vorlageFehler && (
                  <p className="text-sm text-red-600">{vorlageFehler}</p>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {einstellungenOffen && (
        <form
          key={einstellungen.aktualisiert_am}
          onSubmit={handleEinstellungenSpeichern}
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Absender-Name">
              <input
                name="absender_name"
                defaultValue={einstellungen.absender_name ?? ""}
                placeholder="z. B. 90er Coverband Booking"
                className={inputClass}
              />
            </Field>
            <Field label="E-Mail-Adresse">
              <input
                name="email_adresse"
                type="email"
                defaultValue={einstellungen.email_adresse ?? ""}
                placeholder="booking@eure-domain.de"
                className={inputClass}
              />
            </Field>
            <Field
              label={
                einstellungen.passwortGesetzt
                  ? "Passwort (gesetzt – leer lassen zum Behalten)"
                  : "Passwort"
              }
            >
              <input
                name="passwort"
                type="password"
                placeholder={einstellungen.passwortGesetzt ? "••••••••" : ""}
                className={inputClass}
              />
            </Field>
            <div className="hidden sm:block" />
            <Field label="SMTP-Host (Versand)">
              <input
                name="smtp_host"
                defaultValue={einstellungen.smtp_host ?? ""}
                placeholder="z. B. smtp.ionos.de"
                className={inputClass}
              />
            </Field>
            <Field label="SMTP-Port">
              <input
                name="smtp_port"
                type="number"
                defaultValue={einstellungen.smtp_port ?? ""}
                placeholder="587"
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
              <input
                type="checkbox"
                name="smtp_ssl"
                defaultChecked={einstellungen.smtp_ssl}
              />
              SMTP: SSL (typisch Port 465). Bei STARTTLS (typisch Port 587)
              deaktivieren.
            </label>
            <Field label="IMAP-Host (Empfang)">
              <input
                name="imap_host"
                defaultValue={einstellungen.imap_host ?? ""}
                placeholder="z. B. imap.ionos.de"
                className={inputClass}
              />
            </Field>
            <Field label="IMAP-Port">
              <input
                name="imap_port"
                type="number"
                defaultValue={einstellungen.imap_port ?? ""}
                placeholder="993"
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
              <input
                type="checkbox"
                name="imap_ssl"
                defaultChecked={einstellungen.imap_ssl}
              />
              IMAP: SSL
            </label>
          </div>
          <div>
            <button
              type="submit"
              disabled={einstellungenLaeuft}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {einstellungenLaeuft ? "Speichert…" : "Einstellungen speichern"}
            </button>
          </div>
          {einstellungenFehler && (
            <p className="text-sm text-red-600">{einstellungenFehler}</p>
          )}
          {einstellungenHinweis && (
            <p className="text-sm text-green-700">{einstellungenHinweis}</p>
          )}
          <p className="text-xs text-slate-500">
            Das Passwort wird serverseitig gespeichert und nie an den Browser
            zurückgesendet.
          </p>
        </form>
      )}
    </div>
  );
}
