"use client";

import { useRef, useState } from "react";
import { formatDauer } from "@/lib/dauer";
import { sucheSongVorschlaege, type SongVorschlag } from "@/lib/musikSuche";

// Titel-Eingabefeld mit Auto-Vervollständigung aus der iTunes-Suche.
// Beim Tippen erscheint eine Vorschlagsliste (Titel · Interpret · Länge);
// ein Klick ruft onVorschlag auf, damit der Aufrufer Interpret + Originallänge
// in seine übrigen Felder übernehmen kann. Genutzt von der Song-Zeile im
// Produktion-Tab und dem Song-Bearbeiten im Setliste-Builder.
export function SongTitelInput({
  value,
  onChange,
  onVorschlag,
  placeholder = "Titel",
  className,
}: {
  value: string;
  onChange: (wert: string) => void;
  onVorschlag: (vorschlag: SongVorschlag) => void;
  placeholder?: string;
  className?: string;
}) {
  const [vorschlaege, setVorschlaege] = useState<SongVorschlag[]>([]);
  const [zeigeVorschlaege, setZeigeVorschlaege] = useState(false);
  const suchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nur das Ergebnis der zuletzt abgeschickten Suche anzeigen (Race vermeiden,
  // wenn eine frühere, langsamere Antwort nach einer neueren eintrifft).
  const suchLaufId = useRef(0);

  function handleChange(wert: string) {
    onChange(wert);
    if (suchTimer.current) clearTimeout(suchTimer.current);
    const suchbegriff = wert.trim();
    if (suchbegriff.length < 2) {
      setVorschlaege([]);
      setZeigeVorschlaege(false);
      return;
    }
    suchTimer.current = setTimeout(async () => {
      const laufId = ++suchLaufId.current;
      const treffer = await sucheSongVorschlaege(suchbegriff);
      if (laufId !== suchLaufId.current) return; // veraltete Antwort verwerfen
      setVorschlaege(treffer);
      setZeigeVorschlaege(treffer.length > 0);
    }, 350);
  }

  function waehleVorschlag(vorschlag: SongVorschlag) {
    setZeigeVorschlaege(false);
    setVorschlaege([]);
    onVorschlag(vorschlag);
  }

  return (
    <div className="relative w-full">
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => vorschlaege.length > 0 && setZeigeVorschlaege(true)}
        onBlur={() => setTimeout(() => setZeigeVorschlaege(false), 120)}
        placeholder={placeholder}
        className={className}
      />
      {zeigeVorschlaege && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {vorschlaege.map((v, i) => (
            <li key={`${v.titel}-${v.interpret}-${i}`}>
              <button
                type="button"
                // onMouseDown statt onClick: feuert vor dem Input-blur,
                // sonst würde die Liste weg sein, bevor der Klick greift.
                onMouseDown={(e) => {
                  e.preventDefault();
                  waehleVorschlag(v);
                }}
                className="flex w-full items-baseline justify-between gap-3 px-2.5 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-slate-100">
                  {v.titel}
                  {v.interpret && (
                    <span className="text-slate-500 dark:text-slate-400"> · {v.interpret}</span>
                  )}
                </span>
                {v.dauerSekunden !== null && (
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDauer(v.dauerSekunden)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
