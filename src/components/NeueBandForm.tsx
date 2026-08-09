"use client";

import { useState } from "react";
import { createBand } from "@/lib/actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

// Legt eine weitere Band an. Alles Weitere (Pipeline, Kalender, Setliste,
// Produktion, Merch und eine eigene Team-App) steht danach automatisch bereit,
// da sämtliche Daten an der band_id hängen.
export function NeueBandForm() {
  const [offen, setOffen] = useState(false);

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="self-start rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        + Neue Band
      </button>
    );
  }

  return (
    <form
      action={createBand}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-medium text-slate-900">Neue Band anlegen</h2>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Name *
        <input name="name" required placeholder="z. B. Nachtschicht" className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Genre
        <input name="genre" placeholder="z. B. Rock-Cover" className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Logo (optional)
        <input name="logo" type="file" accept="image/*" className="text-sm" />
        <span className="font-normal text-slate-400">
          Wird in der Team-App angezeigt und dient als Symbol auf dem
          Home-Bildschirm – am besten ein möglichst quadratisches Bild.
        </span>
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Band anlegen
        </button>
        <button
          type="button"
          onClick={() => setOffen(false)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
