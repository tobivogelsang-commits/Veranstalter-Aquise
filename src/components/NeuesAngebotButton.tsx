"use client";

import { useState } from "react";
import { erstelleAngebot } from "@/lib/angebotActions";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import type { Band } from "@/lib/types";

// Legt ein leeres Angebot an. Ist genau eine Band gewählt, geht es sofort los;
// bei "Beide" muss erst die Band gewählt werden, da das Angebot immer von
// einer bestimmten Band kommt (Briefkopf, Bankdaten).
export function NeuesAngebotButton({
  bands,
  bandFilter,
}: {
  bands: Band[];
  bandFilter: string;
}) {
  const [wahlOffen, setWahlOffen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  function anlegen(bandId: string) {
    setLaeuft(true);
    erstelleAngebot(bandId, null);
  }

  if (bandFilter !== ALLE_BANDS_PARAM) {
    return (
      <button
        type="button"
        onClick={() => anlegen(bandFilter)}
        disabled={laeuft}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        + Neues Angebot
      </button>
    );
  }

  if (!wahlOffen) {
    return (
      <button
        type="button"
        onClick={() => setWahlOffen(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        + Neues Angebot
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-slate-500">Für welche Band?</span>
      {bands.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => anlegen(b.id)}
          disabled={laeuft}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
