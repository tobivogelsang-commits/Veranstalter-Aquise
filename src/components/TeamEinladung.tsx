"use client";

import { useState } from "react";
import {
  entferneMitglied,
  setzeMitgliedPasswortZurueck,
  setzeRegistrierungOffen,
} from "@/lib/teamActions";
import type { BandMitgliedOhnePush } from "@/lib/types";

export function TeamEinladung({
  bandId,
  inviteUrl,
  qrCodeDataUrl,
  mitglieder,
  registrierungOffen,
}: {
  bandId: string;
  inviteUrl: string;
  qrCodeDataUrl: string;
  mitglieder: BandMitgliedOhnePush[];
  registrierungOffen: boolean;
}) {
  const [kopiert, setKopiert] = useState(false);
  const [offen, setOffen] = useState(registrierungOffen);
  const [schalterLaeuft, setSchalterLaeuft] = useState(false);
  const [loeschenLaeuft, setLoeschenLaeuft] = useState<string | null>(null);
  const [zuruecksetzenLaeuft, setZuruecksetzenLaeuft] = useState<string | null>(null);

  async function handleKopieren() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      // Clipboard-API evtl. nicht verfügbar (z. B. kein HTTPS) - der Link
      // steht als Text trotzdem da und kann manuell kopiert werden.
    }
  }

  async function handleSchalter() {
    const neu = !offen;
    setSchalterLaeuft(true);
    setOffen(neu); // sofort umschalten, damit der Schalter nicht traege wirkt
    const ergebnis = await setzeRegistrierungOffen(bandId, neu);
    setSchalterLaeuft(false);
    if (!ergebnis.ok) {
      setOffen(!neu);
      alert(ergebnis.fehler);
    }
  }

  async function handleZuruecksetzen(mitgliedId: string, name: string) {
    if (
      !confirm(
        `Passwort von ${name} zurücksetzen? ${name} vergibt beim nächsten Anmelden ein neues.`
      )
    ) {
      return;
    }
    setZuruecksetzenLaeuft(mitgliedId);
    const ergebnis = await setzeMitgliedPasswortZurueck(mitgliedId, bandId);
    setZuruecksetzenLaeuft(null);
    if (!ergebnis.ok) alert(ergebnis.fehler);
  }

  async function handleEntfernen(mitgliedId: string) {
    // Bei offener Registrierung ist das Entfernen folgenlos: Der Name wird
    // wieder frei und die Person kann sich sofort neu eintragen. Darauf
    // hinweisen, statt ein falsches Gefuehl von Kontrolle zu erzeugen.
    const zusatz = offen
      ? "\n\nAchtung: Neue Anmeldungen sind für diese Band offen – die Person kann sich danach einfach wieder eintragen. Schalte das unten aus, wenn das nicht passieren soll."
      : "";
    if (
      !confirm(
        `Mitglied wirklich entfernen? Push-Benachrichtigungen enden damit.${zusatz}`
      )
    ) {
      return;
    }
    setLoeschenLaeuft(mitgliedId);
    await entferneMitglied(mitgliedId, bandId);
    setLoeschenLaeuft(null);
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Team-App</h3>
        <p className="mt-1 text-xs text-slate-500">
          Link oder QR-Code an die Band-Mitglieder schicken. Beim ersten Öffnen
          Namen und ein selbst gewähltes Passwort eingeben – mit denselben Angaben
          kommt man auch auf einem weiteren Gerät wieder rein. Danach kommen
          Verfügbarkeits-Anfragen per Push-Benachrichtigung.
        </p>
      </div>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrCodeDataUrl}
          alt="QR-Code zur Team-App"
          className="h-32 w-32 rounded-md border border-slate-200"
        />
        <div className="flex flex-col gap-2">
          <code className="break-all rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">
            {inviteUrl}
          </code>
          <button
            type="button"
            onClick={handleKopieren}
            className="self-start rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {kopiert ? "✓ Kopiert" : "Link kopieren"}
          </button>
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold text-slate-700">
          Registrierte Mitglieder
        </h4>
        {mitglieder.length === 0 ? (
          <p className="text-xs text-slate-500">Noch niemand registriert.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {mitglieder.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  {m.name}
                  {/* Ohne Passwort = Mitglied aus der Zeit vor der Umstellung;
                      es vergibt eines bei der naechsten Anmeldung. */}
                  {!m.hat_passwort && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      noch kein Passwort
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  {m.hat_passwort && (
                    <button
                      type="button"
                      disabled={zuruecksetzenLaeuft === m.id}
                      onClick={() => handleZuruecksetzen(m.id, m.name)}
                      className="text-xs font-medium text-slate-600 hover:underline disabled:opacity-50"
                      title="Für den Fall, dass jemand sein Passwort vergessen hat"
                    >
                      Passwort zurücksetzen
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={loeschenLaeuft === m.id}
                    onClick={() => handleEntfernen(m.id)}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    Entfernen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Der Schalter ist das Gegenstueck zum Entfernen: Ohne ihn traegt sich
          eine entfernte Person einfach wieder ein, da der Band-Link weiter
          gilt. Bestehende Mitglieder koennen sich auch zugeschaltet weiter
          anmelden - sonst waere ein verlorenes Handy ein Zugangsverlust. */}
      <div className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div>
          <p className="text-xs font-semibold text-slate-700">Neue Anmeldungen</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {offen
              ? "Offen – jede Person mit dem Link kann sich eintragen. Wenn die Band vollzählig ist, hier zuschalten."
              : "Zu – niemand Neues kann sich eintragen. Die bestehenden Mitglieder melden sich weiterhin an, auch auf einem neuen Gerät."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSchalter}
          disabled={schalterLaeuft}
          aria-pressed={offen}
          className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
            offen
              ? "border border-slate-300 text-slate-700 hover:bg-slate-100"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {offen ? "Zuschalten" : "Wieder öffnen"}
        </button>
      </div>
    </div>
  );
}
