"use client";

import { useState } from "react";
import { loescheBand } from "@/lib/actions";
import type { BandLoeschUmfang } from "@/lib/queries";

// Band endgültig löschen. Bewusst als aufklappbarer "Gefahrenbereich" am Ende
// der Band-Seite, mit Auflistung dessen, was mit verschwindet, und dem exakten
// Bandnamen als Bestätigung - ein Fehlklick kann so nicht die falsche Band
// erwischen.
export function BandLoeschenPanel({
  bandId,
  bandName,
  umfang,
}: {
  bandId: string;
  bandName: string;
  umfang: BandLoeschUmfang;
}) {
  const [offen, setOffen] = useState(false);
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const posten: { label: string; anzahl: number }[] = [
    { label: "Team-Mitglieder (inkl. Urlaube und Zusagen)", anzahl: umfang.mitglieder },
    { label: "Songs im Katalog", anzahl: umfang.songs },
    { label: "Setlisten", anzahl: umfang.setlisten },
    { label: "Kalender-Termine", anzahl: umfang.termine },
    { label: "Produktions-Einträge", anzahl: umfang.produktionen },
    { label: "Merch-Artikel (inkl. Vorlagen)", anzahl: umfang.merchArtikel },
    { label: "Veranstalter-Zuordnungen", anzahl: umfang.venueZuordnungen },
    { label: "E-Mails im Verlauf", anzahl: umfang.emails },
  ].filter((p) => p.anzahl > 0);

  async function handleLoeschen() {
    if (laeuft) return;
    setLaeuft(true);
    setFehler(null);
    // Bei Erfolg leitet die Aktion auf die Übersicht um und kehrt nie zurück.
    const ergebnis = await loescheBand(bandId, eingabe);
    setLaeuft(false);
    if (ergebnis && !ergebnis.ok) setFehler(ergebnis.fehler);
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="self-start text-sm text-red-600 underline hover:text-red-800"
      >
        Band löschen…
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-900">
        „{bandName}&ldquo; endgültig löschen
      </h2>

      {posten.length > 0 ? (
        <>
          <p className="mt-2 text-sm text-red-800">
            Damit verschwindet unwiderruflich auch:
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-red-800">
            {posten.map((p) => (
              <li key={p.label}>
                {p.anzahl} {p.label}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-red-800">
          An dieser Band hängen keine weiteren Daten.
        </p>
      )}

      <p className="mt-2 text-xs text-red-700">
        Die Veranstalter selbst bleiben erhalten – nur ihre Zuordnung zu dieser
        Band geht verloren. Auch die Team-App dieser Band ist danach nicht mehr
        erreichbar.
      </p>

      <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-red-900">
        Zur Bestätigung den Bandnamen eintippen:
        <input
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          placeholder={bandName}
          className="w-full max-w-sm rounded-md border border-red-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleLoeschen}
          disabled={laeuft || eingabe.trim() !== bandName}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {laeuft ? "Wird gelöscht…" : "Endgültig löschen"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOffen(false);
            setEingabe("");
            setFehler(null);
          }}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Abbrechen
        </button>
      </div>
      {fehler && <p className="mt-2 text-xs text-red-700">{fehler}</p>}
    </div>
  );
}
