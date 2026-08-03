"use client";

import { useState } from "react";
import clsx from "clsx";
import { MerchBestandsListe, istKnapp } from "@/components/MerchBestandsListe";
import type { MerchArtikel } from "@/lib/types";

// Merch-Ansicht der Team-App: bewusst reduziert auf das, was unterwegs zählt -
// Bestand sehen und nach einem Gig abbuchen. Anlegen, Mindestbestände und
// Vorlagen bleiben dem Desktop vorbehalten.
export function MerchListe({
  bandId,
  initialArtikel,
  aufDunkel = false,
}: {
  bandId: string;
  initialArtikel: MerchArtikel[];
  aufDunkel?: boolean;
}) {
  const [artikel, setArtikel] = useState<MerchArtikel[]>(initialArtikel);

  const knapp = artikel.filter(istKnapp);

  function handleBestand(artikelId: string, bestand: number) {
    setArtikel((prev) => prev.map((a) => (a.id === artikelId ? { ...a, bestand } : a)));
  }

  return (
    <div className="flex flex-col gap-4">
      {knapp.length > 0 && (
        <p
          className={clsx(
            "rounded-md p-3 text-xs",
            aufDunkel
              ? "bg-white/10 text-slate-100"
              : "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
          )}
        >
          {knapp.length === 1
            ? "1 Artikel geht zur Neige."
            : `${knapp.length} Artikel gehen zur Neige.`}{" "}
          Tobias kümmert sich ums Nachbestellen.
        </p>
      )}

      <MerchBestandsListe
        bandId={bandId}
        artikel={artikel}
        onBestandGeaendert={handleBestand}
        kompakt
        aufDunkel={aufDunkel}
      />

      <p
        className={clsx(
          "text-xs",
          aufDunkel ? "text-slate-300" : "text-slate-400 dark:text-slate-500"
        )}
      >
        Nach dem Gig mit − abziehen, was verkauft wurde. Bei der Inventur die
        gezählte Menge direkt ins Feld eintippen.
      </p>
    </div>
  );
}
