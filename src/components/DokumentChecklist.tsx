"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  entferneDokumentTyp,
  fuegeDokumentTypHinzu,
  toggleDokumentVersendet,
} from "@/lib/dokumentActions";
import type { BandDokumentTyp, VenueBandDokument } from "@/lib/types";

// Ankreuzbare Liste, welche Dokumente (Stage Rider, Angebot, Pressetext etc.)
// an diesen Veranstalter (für diese eine Band) schon verschickt wurden - auf
// einen Blick sichtbar, was noch fehlt. Die Liste möglicher Dokumente ist pro
// Band erweiterbar ("+ hinzufügen" unten) und steht dann für alle
// Veranstalter dieser Band zur Verfügung. Kein <form> (steckt im
// Veranstalter-Speichern-Formular), Aktionen laufen über Button-Klicks.
export function DokumentChecklist({
  bandId,
  venueId,
  dokumentTypen,
  versendet,
}: {
  bandId: string;
  venueId: string;
  dokumentTypen: BandDokumentTyp[];
  versendet: VenueBandDokument[];
}) {
  const router = useRouter();
  const [neuerTyp, setNeuerTyp] = useState("");
  const [hinzufuegenLaeuft, setHinzufuegenLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  function versendetAm(typId: string): string | null {
    return (
      versendet.find((v) => v.dokument_typ_id === typId)?.versendet_am ?? null
    );
  }

  async function handleToggle(typId: string) {
    await toggleDokumentVersendet(venueId, bandId, typId);
    router.refresh();
  }

  async function handleHinzufuegen() {
    if (!neuerTyp.trim()) return;
    setHinzufuegenLaeuft(true);
    setFehler(null);
    const ergebnis = await fuegeDokumentTypHinzu(bandId, neuerTyp, venueId);
    setHinzufuegenLaeuft(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    setNeuerTyp("");
    router.refresh();
  }

  async function handleEntfernen(typId: string) {
    await entferneDokumentTyp(typId, venueId);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-medium text-slate-900">Dokumente</h4>
      {dokumentTypen.length === 0 ? (
        <p className="text-xs text-slate-500">Noch keine Dokument-Typen angelegt.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {dokumentTypen.map((typ) => {
            const datum = versendetAm(typ.id);
            return (
              <li key={typ.id} className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(datum)}
                    onChange={() => handleToggle(typ.id)}
                  />
                  {typ.name}
                  {datum && (
                    <span className="text-xs text-slate-400">
                      seit {format(new Date(datum), "dd.MM.yyyy")}
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => handleEntfernen(typ.id)}
                  className="text-xs text-slate-400 hover:text-red-600"
                  title="Dokument-Typ entfernen"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          value={neuerTyp}
          onChange={(e) => setNeuerTyp(e.target.value)}
          placeholder="z. B. Vertrag"
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={hinzufuegenLaeuft}
          onClick={handleHinzufuegen}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          + Hinzufügen
        </button>
      </div>
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
    </div>
  );
}
