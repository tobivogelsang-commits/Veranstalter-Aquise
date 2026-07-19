"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fuegeProtokollEintragHinzu } from "@/lib/protokollActions";
import { TYP_LABELS } from "@/lib/protokollTypen";
import type { VenueBandProtokoll } from "@/lib/types";

const MANUELLE_TYPEN = [
  "notiz",
  "anruf",
  "instagram",
  "facebook",
  "tiktok",
  "kontakt",
] as const;

// Protokoll/Log für diesen Veranstalter UND diese eine Band (komplett
// getrennt, wie Dokumente/Mails). Manuelle Einträge (Notiz, Anrufversuch,
// Social-Media-Kontakt) werden hier erfasst, automatische Einträge
// (E-Mail verschickt/beantwortet) kommen direkt aus emailActions.ts. Kein
// <form> (steckt im Veranstalter-Speichern-Formular), Aktionen laufen über
// Button-Klicks.
export function VenueProtokoll({
  bandId,
  venueId,
  eintraege,
}: {
  bandId: string;
  venueId: string;
  eintraege: VenueBandProtokoll[];
}) {
  const router = useRouter();
  const [typ, setTyp] = useState<string>("notiz");
  const [text, setText] = useState("");
  const [wirdGespeichert, setWirdGespeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function handleHinzufuegen() {
    if (!text.trim()) return;
    setWirdGespeichert(true);
    setFehler(null);
    const ergebnis = await fuegeProtokollEintragHinzu(venueId, bandId, typ, text);
    setWirdGespeichert(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-medium text-slate-900">Protokoll</h4>
      <div className="flex items-center gap-2">
        <select
          value={typ}
          onChange={(e) => setTyp(e.target.value)}
          className="w-32 shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
        >
          {MANUELLE_TYPEN.map((t) => (
            <option key={t} value={t}>
              {TYP_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="z. B. niemand erreicht, morgen nochmal versuchen"
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={wirdGespeichert}
          onClick={handleHinzufuegen}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          + Eintrag
        </button>
      </div>
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
      {eintraege.length === 0 ? (
        <p className="text-xs text-slate-500">Noch keine Einträge.</p>
      ) : (
        <ul className="flex flex-col">
          {eintraege.map((eintrag) => (
            <li
              key={eintrag.id}
              className="flex items-start justify-between gap-2 border-t border-slate-100 py-1.5 first:border-t-0"
            >
              <div className="min-w-0">
                <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {TYP_LABELS[eintrag.typ] ?? eintrag.typ}
                </span>
                {eintrag.text && (
                  <p className="mt-0.5 text-xs text-slate-600">{eintrag.text}</p>
                )}
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                {format(new Date(eintrag.erstellt_am), "dd.MM.yyyy · HH:mm")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
