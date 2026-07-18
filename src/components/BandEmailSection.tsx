"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import clsx from "clsx";
import {
  holeEingehendeEmails,
  sendeEmail,
  speichereEmailEinstellungen,
} from "@/lib/emailActions";
import type {
  BandEmailMitVenue,
  BandVenueOption,
  EmailEinstellungenOhnePasswort,
} from "@/lib/types";

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

export function BandEmailSection({
  bandId,
  einstellungen,
  emails,
  venues,
  vorausgewaehlteVenueId,
}: {
  bandId: string;
  einstellungen: EmailEinstellungenOhnePasswort;
  emails: BandEmailMitVenue[];
  venues: BandVenueOption[];
  vorausgewaehlteVenueId?: string;
}) {
  const router = useRouter();

  const vorausgewaehlterVenue = venues.find(
    (v) => v.id === vorausgewaehlteVenueId
  );

  const [einstellungenOffen, setEinstellungenOffen] = useState(false);
  const [einstellungenLaeuft, setEinstellungenLaeuft] = useState(false);
  const [einstellungenFehler, setEinstellungenFehler] = useState<string | null>(
    null
  );
  const [einstellungenHinweis, setEinstellungenHinweis] = useState<
    string | null
  >(null);

  const [venueId, setVenueId] = useState(vorausgewaehlteVenueId ?? "");
  const [an, setAn] = useState(vorausgewaehlterVenue?.email ?? "");
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [sendenLaeuft, setSendenLaeuft] = useState(false);
  const [sendenFehler, setSendenFehler] = useState<string | null>(null);

  function handleVenueAuswahl(id: string) {
    setVenueId(id);
    const gewaehlt = venues.find((v) => v.id === id);
    if (gewaehlt?.email) setAn(gewaehlt.email);
  }

  const [abrufenLaeuft, setAbrufenLaeuft] = useState(false);
  const [abrufenFehler, setAbrufenFehler] = useState<string | null>(null);

  const [geoeffneteMail, setGeoeffneteMail] = useState<string | null>(null);

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

  async function handleSenden(e: React.FormEvent) {
    e.preventDefault();
    setSendenLaeuft(true);
    setSendenFehler(null);
    const ergebnis = await sendeEmail(bandId, an, betreff, text, venueId || null);
    setSendenLaeuft(false);
    if (!ergebnis.ok) {
      setSendenFehler(ergebnis.fehler);
      return;
    }
    setVenueId("");
    setAn("");
    setBetreff("");
    setText("");
    router.refresh();
  }

  async function handleAbrufen() {
    setAbrufenLaeuft(true);
    setAbrufenFehler(null);
    const ergebnis = await holeEingehendeEmails(bandId);
    setAbrufenLaeuft(false);
    if (!ergebnis.ok) {
      setAbrufenFehler(ergebnis.fehler);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-slate-900">E-Mail</h2>
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
          <textarea
            required
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass}
          />
        </Field>
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

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-900">Verlauf</h3>
          <button
            type="button"
            disabled={abrufenLaeuft}
            onClick={handleAbrufen}
            className="text-xs font-medium text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
          >
            {abrufenLaeuft ? "Postfach wird geprüft…" : "Postfach aktualisieren"}
          </button>
        </div>
        {abrufenFehler && (
          <p className="mb-2 text-sm text-red-600">{abrufenFehler}</p>
        )}

        {emails.length === 0 ? (
          <p className="text-sm text-slate-500">Noch keine E-Mails.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {emails.map((mail) => {
              const offen = geoeffneteMail === mail.id;
              return (
                <li
                  key={mail.id}
                  className="rounded-lg border border-slate-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => setGeoeffneteMail(offen ? null : mail.id)}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {mail.betreff || "(kein Betreff)"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {mail.richtung === "gesendet"
                          ? `An: ${mail.an}`
                          : `Von: ${mail.von}`}
                      </p>
                      {mail.venue && (
                        <Link
                          href={`/venues/${mail.venue.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-slate-500 underline"
                        >
                          → {mail.venue.name}
                        </Link>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={clsx(
                          "inline-block rounded-full px-2 py-0.5 text-xs",
                          mail.richtung === "gesendet"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-green-100 text-green-700"
                        )}
                      >
                        {mail.richtung === "gesendet" ? "Gesendet" : "Empfangen"}
                      </span>
                      <p className="mt-1 text-xs text-slate-400">
                        {format(new Date(mail.zeitpunkt), "dd.MM.yyyy HH:mm")}
                      </p>
                    </div>
                  </button>
                  {offen && (
                    <div className="whitespace-pre-wrap border-t border-slate-100 p-3 text-sm text-slate-700">
                      {mail.text_inhalt || "(kein Inhalt)"}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
