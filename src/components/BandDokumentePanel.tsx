"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  entferneDokumentDatei,
  entferneDokumentTyp,
  fuegeDokumentTypHinzu,
  ladeDokumentDateiHoch,
} from "@/lib/dokumentActions";
import type { BandDokumentTyp } from "@/lib/types";

// Verwaltet die band-weite Dokument-Typen-Liste (Stage Rider, Angebot,
// Pressetext etc. - dieselbe Liste wie die Checkliste auf der Veranstalter-
// Seite) und die dahinter hinterlegte Datei. Diese Datei lässt sich dann im
// Mail-Compose-Bereich mit einem Klick anhängen, ohne sie erneut hochladen zu
// müssen.
export function BandDokumentePanel({
  bandId,
  dokumentTypen,
}: {
  bandId: string;
  dokumentTypen: BandDokumentTyp[];
}) {
  const router = useRouter();
  const [neuerTyp, setNeuerTyp] = useState("");
  const [hinzufuegenLaeuft, setHinzufuegenLaeuft] = useState(false);
  const [uploadLaeuft, setUploadLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function handleHinzufuegen() {
    if (!neuerTyp.trim()) return;
    setHinzufuegenLaeuft(true);
    setFehler(null);
    const ergebnis = await fuegeDokumentTypHinzu(
      bandId,
      neuerTyp,
      `/einstellungen/${bandId}`
    );
    setHinzufuegenLaeuft(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    setNeuerTyp("");
    router.refresh();
  }

  async function handleTypEntfernen(typId: string) {
    await entferneDokumentTyp(typId, `/einstellungen/${bandId}`);
    router.refresh();
  }

  async function handleDateiHochladen(
    typId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const datei = e.target.files?.[0];
    e.target.value = "";
    if (!datei) return;

    setUploadLaeuft(typId);
    setFehler(null);
    const formData = new FormData();
    formData.set("datei", datei);
    const ergebnis = await ladeDokumentDateiHoch(bandId, typId, formData);
    setUploadLaeuft(null);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    router.refresh();
  }

  async function handleDateiEntfernen(typId: string) {
    await entferneDokumentDatei(typId, bandId);
    router.refresh();
  }

  return (
    <div>
      <h2 className="mb-2 text-base font-medium text-slate-900">Dokumente</h2>
      <p className="mb-3 text-xs text-slate-500">
        Stage Rider, Angebot, Pressetext etc. - hinterlegte Dateien lassen
        sich beim Mail-Schreiben mit einem Klick anhängen.
      </p>

      {dokumentTypen.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">Noch keine Dokument-Typen angelegt.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {dokumentTypen.map((typ) => (
            <li
              key={typ.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{typ.name}</p>
                {typ.datei_url ? (
                  <a
                    href={typ.datei_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-slate-500 underline"
                  >
                    {typ.dateiname}
                  </a>
                ) : (
                  <p className="text-xs text-slate-400">Keine Datei hinterlegt.</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <label className="cursor-pointer text-xs font-medium text-slate-600 underline hover:text-slate-900">
                  {uploadLaeuft === typ.id
                    ? "Lädt hoch…"
                    : typ.datei_url
                      ? "ersetzen"
                      : "Datei hochladen"}
                  <input
                    type="file"
                    disabled={uploadLaeuft === typ.id}
                    onChange={(e) => handleDateiHochladen(typ.id, e)}
                    className="hidden"
                  />
                </label>
                {typ.datei_url && (
                  <button
                    type="button"
                    onClick={() => handleDateiEntfernen(typ.id)}
                    className="text-xs font-medium text-slate-600 hover:text-red-600"
                  >
                    entfernen
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleTypEntfernen(typ.id)}
                  className="text-slate-400 hover:text-red-600"
                  title="Dokument-Typ entfernen"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          value={neuerTyp}
          onChange={(e) => setNeuerTyp(e.target.value)}
          placeholder="z. B. Vertrag"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={hinzufuegenLaeuft}
          onClick={handleHinzufuegen}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          + Hinzufügen
        </button>
      </div>
      {fehler && <p className="mt-2 text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
