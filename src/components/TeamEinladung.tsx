"use client";

import { useState } from "react";
import {
  entferneMitglied,
  erstelleTeamEinladung,
  erstelleTeamPasswortLink,
} from "@/lib/teamActions";
import type { BandMitgliedOhnePush } from "@/lib/types";

// Admin-Verwaltung der Team-App-Mitglieder: Einladungs- und Zugangslinks
// (Einmal-Links, verschickt der Admin selbst), Mitglieder entfernen.
// Der Band-Link/QR-Code bleibt fuer bestehende Mitglieder (App neu oeffnen,
// Home-Bildschirm) - ein Konto entsteht darueber nicht mehr.
export function TeamEinladung({
  bandId,
  inviteUrl,
  qrCodeDataUrl,
  mitglieder,
}: {
  bandId: string;
  inviteUrl: string;
  qrCodeDataUrl: string;
  mitglieder: BandMitgliedOhnePush[];
}) {
  const [kopiert, setKopiert] = useState(false);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  // Zuletzt erzeugter Einmal-Link. Nur hier im Browser sichtbar - in der DB
  // liegt nur der Hash; neu laden = weg (neu erzeugen geht immer).
  const [neuerLink, setNeuerLink] = useState<{
    beschreibung: string;
    url: string;
  } | null>(null);
  const [linkKopiert, setLinkKopiert] = useState(false);

  async function kopiere(text: string, fertig: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      fertig(true);
      setTimeout(() => fertig(false), 2000);
    } catch {
      // Clipboard-API evtl. nicht verfuegbar - der Link steht als Text da.
    }
  }

  function zeigeLink(beschreibung: string, pfad: string) {
    setNeuerLink({ beschreibung, url: `${window.location.origin}${pfad}` });
    setLinkKopiert(false);
  }

  async function handleEinladen() {
    setLaeuft("einladen");
    setFehler(null);
    const ergebnis = await erstelleTeamEinladung(bandId);
    setLaeuft(null);
    if (!ergebnis.ok) return setFehler(ergebnis.fehler);
    zeigeLink("Einladungslink für ein neues Mitglied (7 Tage gültig, einmal nutzbar)", ergebnis.pfad);
  }

  async function handleZugangslink(m: BandMitgliedOhnePush) {
    setLaeuft(m.id);
    setFehler(null);
    const ergebnis = await erstelleTeamPasswortLink(m.id, bandId);
    setLaeuft(null);
    if (!ergebnis.ok) return setFehler(ergebnis.fehler);
    zeigeLink(`Zugangslink für ${m.name} – Passwort festlegen (7 Tage gültig, einmal nutzbar)`, ergebnis.pfad);
  }

  async function handleEntfernen(m: BandMitgliedOhnePush) {
    if (
      !confirm(
        `${m.name} wirklich entfernen? Push-Benachrichtigungen enden, die Person kann sich nicht mehr anmelden. Wieder dabei nur über einen neuen Einladungslink.`
      )
    ) {
      return;
    }
    setLaeuft(m.id);
    await entferneMitglied(m.id, bandId);
    setLaeuft(null);
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Team-App</h3>
          <p className="mt-1 text-xs text-slate-500">
            Neue Mitglieder kommen nur über einen persönlichen Einladungslink
            hinein (Name + Passwort festlegen). Mitglieder ohne Passwort oder
            mit vergessenem Passwort bekommen einen Zugangslink.
          </p>
        </div>
        <button
          type="button"
          onClick={handleEinladen}
          disabled={laeuft !== null}
          className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Mitglied einladen
        </button>
      </div>

      {fehler && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{fehler}</p>
      )}

      {neuerLink && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-700">{neuerLink.beschreibung}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-slate-600">
              {neuerLink.url}
            </code>
            <button
              type="button"
              onClick={() => kopiere(neuerLink.url, setLinkKopiert)}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {linkKopiert ? "✓ Kopiert" : "Kopieren"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Jetzt verschicken – nach dem Verlassen der Seite ist der Link hier
            nicht mehr abrufbar (neu erzeugen geht immer).
          </p>
        </div>
      )}

      <div>
        <h4 className="mb-1 text-xs font-semibold text-slate-700">Mitglieder</h4>
        {mitglieder.length === 0 ? (
          <p className="text-xs text-slate-500">Noch niemand dabei.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {mitglieder.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  {m.name}
                  {!m.hat_passwort && (
                    <span
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                      title="Kann sich erst anmelden, wenn über den Zugangslink ein Passwort gesetzt ist"
                    >
                      noch kein Passwort
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={laeuft !== null}
                    onClick={() => handleZugangslink(m)}
                    className="text-xs font-medium text-slate-600 hover:underline disabled:opacity-50"
                    title="Einmal-Link zum (neu) Festlegen des Passworts"
                  >
                    Zugangslink
                  </button>
                  <button
                    type="button"
                    disabled={laeuft !== null}
                    onClick={() => handleEntfernen(m)}
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

      <div className="flex flex-col items-start gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrCodeDataUrl}
          alt="QR-Code zur Team-App"
          className="h-24 w-24 rounded-md border border-slate-200"
        />
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">
            App-Link für bestehende Mitglieder (z. B. auf einem neuen Handy
            öffnen und zum Home-Bildschirm hinzufügen). Ein Konto entsteht
            darüber nicht – dafür braucht es den Einladungslink.
          </p>
          <code className="break-all rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">
            {inviteUrl}
          </code>
          <button
            type="button"
            onClick={() => kopiere(inviteUrl, setKopiert)}
            className="self-start rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {kopiert ? "✓ Kopiert" : "App-Link kopieren"}
          </button>
        </div>
      </div>
    </div>
  );
}
