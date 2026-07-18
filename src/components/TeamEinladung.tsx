"use client";

import { useState } from "react";
import { entferneMitglied } from "@/lib/teamActions";
import type { BandMitgliedOhnePush } from "@/lib/types";

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
  const [loeschenLaeuft, setLoeschenLaeuft] = useState<string | null>(null);

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

  async function handleEntfernen(mitgliedId: string) {
    if (!confirm("Mitglied wirklich entfernen? Push-Benachrichtigungen enden damit.")) {
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
          Link oder QR-Code an die Band-Mitglieder schicken. Beim ersten Öffnen einmalig
          Namen eingeben (kein Passwort), danach kommen Verfügbarkeits-Anfragen per
          Push-Benachrichtigung.
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
                <span>{m.name}</span>
                <button
                  type="button"
                  disabled={loeschenLaeuft === m.id}
                  onClick={() => handleEntfernen(m.id)}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
