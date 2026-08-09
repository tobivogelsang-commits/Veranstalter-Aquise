"use client";

import { useRef, useState } from "react";
import { entferneBandLogo, ladeBandLogoHoch } from "@/lib/actions";

// Logo einer bestehenden Band: wird in der Team-App angezeigt und dient als
// Symbol auf dem Home-Bildschirm (Web-App-Manifest).
export function BandLogoPanel({
  bandId,
  bandName,
  logoUrl,
}: {
  bandId: string;
  bandName: string;
  logoUrl: string | null;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const dateiRef = useRef<HTMLInputElement>(null);

  async function handleHochladen() {
    const datei = dateiRef.current?.files?.[0];
    if (!datei || laeuft) return;
    setLaeuft(true);
    setFehler(null);

    const formData = new FormData();
    formData.set("logo", datei);
    const ergebnis = await ladeBandLogoHoch(bandId, formData);
    setLaeuft(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    // Neu laden, damit die frische öffentliche URL überall greift.
    window.location.reload();
  }

  async function handleEntfernen() {
    if (!confirm("Logo wirklich entfernen?")) return;
    setFehler(null);
    const ergebnis = await entferneBandLogo(bandId);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-900">Logo</h2>
      <p className="mt-1 text-xs text-slate-500">
        Wird in der Team-App angezeigt und ist das Symbol auf dem
        Home-Bildschirm. Am besten ein möglichst quadratisches Bild.
      </p>

      <div className="mt-3 flex items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={bandName}
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl text-slate-400">
            🎸
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input ref={dateiRef} type="file" accept="image/*" className="text-sm" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleHochladen}
              disabled={laeuft}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {laeuft ? "Lädt…" : logoUrl ? "Ersetzen" : "Hochladen"}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={handleEntfernen}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Entfernen
              </button>
            )}
          </div>
        </div>
      </div>
      {fehler && <p className="mt-2 text-xs text-red-600">{fehler}</p>}
    </div>
  );
}
