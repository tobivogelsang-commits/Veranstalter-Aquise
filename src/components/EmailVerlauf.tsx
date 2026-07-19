"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import clsx from "clsx";
import { holeEingehendeEmails } from "@/lib/emailActions";
import type { BandEmailMitVenue } from "@/lib/types";

type Ordner = "eingang" | "ausgang";

// Mail-Verlauf im Apple-Mail-Stil: Eingang/Ausgang getrennt statt einer
// gemischten Liste, Liste + Detailansicht nebeneinander (Desktop) bzw.
// nacheinander mit Zurück-Link (schmale Bildschirme).
export function EmailVerlauf({
  bandId,
  emails,
}: {
  bandId: string;
  emails: BandEmailMitVenue[];
}) {
  const router = useRouter();
  const [ordner, setOrdner] = useState<Ordner>("eingang");
  const [ausgewaehlteMailId, setAusgewaehlteMailId] = useState<string | null>(
    null
  );
  const [abrufenLaeuft, setAbrufenLaeuft] = useState(false);
  const [abrufenFehler, setAbrufenFehler] = useState<string | null>(null);

  const eingang = emails.filter((m) => m.richtung === "empfangen");
  const ausgang = emails.filter((m) => m.richtung === "gesendet");
  const liste = ordner === "eingang" ? eingang : ausgang;
  const ausgewaehlteMail =
    liste.find((m) => m.id === ausgewaehlteMailId) ?? null;

  function ordnerWechseln(neu: Ordner) {
    setOrdner(neu);
    setAusgewaehlteMailId(null);
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => ordnerWechseln("eingang")}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              ordner === "eingang"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            Eingang ({eingang.length})
          </button>
          <button
            type="button"
            onClick={() => ordnerWechseln("ausgang")}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              ordner === "ausgang"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            Ausgang ({ausgang.length})
          </button>
        </div>
        <button
          type="button"
          disabled={abrufenLaeuft}
          onClick={handleAbrufen}
          className="text-xs font-medium text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
        >
          {abrufenLaeuft ? "Postfach wird geprüft…" : "Postfach aktualisieren"}
        </button>
      </div>
      {abrufenFehler && <p className="text-sm text-red-600">{abrufenFehler}</p>}

      <div className="flex min-h-[420px] overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div
          className={clsx(
            "w-full shrink-0 divide-y divide-slate-100 overflow-y-auto sm:block sm:w-72 sm:border-r sm:border-slate-200",
            ausgewaehlteMail && "hidden sm:block"
          )}
        >
          {liste.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              {ordner === "eingang" ? "Kein Posteingang." : "Noch nichts gesendet."}
            </p>
          ) : (
            liste.map((mail) => (
              <button
                key={mail.id}
                type="button"
                onClick={() => setAusgewaehlteMailId(mail.id)}
                className={clsx(
                  "block w-full p-3 text-left hover:bg-slate-50",
                  ausgewaehlteMail?.id === mail.id && "bg-slate-100"
                )}
              >
                <p className="truncate text-sm font-medium text-slate-900">
                  {mail.richtung === "gesendet"
                    ? mail.an || "(kein Empfänger)"
                    : mail.von || "(unbekannt)"}
                </p>
                <p className="truncate text-xs text-slate-600">
                  {mail.betreff || "(kein Betreff)"}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {format(new Date(mail.zeitpunkt), "dd.MM.yyyy HH:mm")}
                </p>
              </button>
            ))
          )}
        </div>

        <div
          className={clsx(
            "flex-1 overflow-y-auto p-4",
            !ausgewaehlteMail && "hidden sm:flex sm:items-center sm:justify-center"
          )}
        >
          {!ausgewaehlteMail ? (
            <p className="text-sm text-slate-400">Wähle eine E-Mail aus.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setAusgewaehlteMailId(null)}
                className="self-start text-xs font-medium text-slate-600 underline sm:hidden"
              >
                ← Zurück
              </button>
              <div>
                <p className="text-base font-medium text-slate-900">
                  {ausgewaehlteMail.betreff || "(kein Betreff)"}
                </p>
                <p className="text-xs text-slate-500">
                  {ausgewaehlteMail.richtung === "gesendet"
                    ? `An: ${ausgewaehlteMail.an}`
                    : `Von: ${ausgewaehlteMail.von}`}
                </p>
                <p className="text-xs text-slate-400">
                  {format(
                    new Date(ausgewaehlteMail.zeitpunkt),
                    "dd.MM.yyyy HH:mm"
                  )}
                </p>
                {ausgewaehlteMail.venue && (
                  <Link
                    href={`/venues/${ausgewaehlteMail.venue.id}`}
                    className="text-xs text-slate-500 underline"
                  >
                    → {ausgewaehlteMail.venue.name}
                  </Link>
                )}
              </div>
              <div className="border-t border-slate-100 pt-3 text-sm text-slate-700">
                {ausgewaehlteMail.richtung === "gesendet" ? (
                  <div
                    className="[&_img]:my-2 [&_img]:max-w-full"
                    dangerouslySetInnerHTML={{
                      __html: ausgewaehlteMail.text_inhalt || "(kein Inhalt)",
                    }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">
                    {ausgewaehlteMail.text_inhalt || "(kein Inhalt)"}
                  </p>
                )}
              </div>
              {ausgewaehlteMail.anhaenge && ausgewaehlteMail.anhaenge.length > 0 && (
                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-2">
                  {ausgewaehlteMail.anhaenge.map((a) => (
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
          )}
        </div>
      </div>
    </div>
  );
}
