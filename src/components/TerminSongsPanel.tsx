"use client";

import { useState } from "react";
import clsx from "clsx";
import { speichereTerminSongs } from "@/lib/terminActions";
import { formatDauer, summeDauer } from "@/lib/dauer";
import type { BandSong } from "@/lib/types";

// "Songs zum Proben" für ein konkretes Proben-Vorkommen: zeigt die Liste
// (mit Gesamtdauer) und erlaubt Hinzufügen aus dem Band-Katalog sowie
// Entfernen. Speichert bei jeder Änderung sofort (optimistisch, wie beim
// Setliste-Builder). Wird im Proben-Modal des Kalenders (Desktop + Team-App)
// und auf der "Nächste Probe"-Karte im Team-Dashboard genutzt - aufDunkel
// passt die Textfarben an den dunklen Dashboard-Hintergrund an.
export function TerminSongsPanel({
  terminId,
  bandId,
  vorkommenDatum,
  katalog,
  initialSongs,
  onChange,
  aufDunkel = false,
}: {
  terminId: string;
  bandId: string;
  vorkommenDatum: string;
  katalog: BandSong[];
  initialSongs: BandSong[];
  onChange?: (songs: BandSong[]) => void;
  aufDunkel?: boolean;
}) {
  const [songs, setSongs] = useState<BandSong[]>(initialSongs);
  const [fehler, setFehler] = useState<string | null>(null);

  const gewaehlteIds = new Set(songs.map((s) => s.id));
  const auswahl = katalog.filter((s) => !gewaehlteIds.has(s.id));
  const gesamt = summeDauer(songs.map((s) => s.dauer_sekunden));

  function speichern(next: BandSong[]) {
    setSongs(next);
    onChange?.(next);
    speichereTerminSongs(
      terminId,
      bandId,
      vorkommenDatum,
      next.map((s) => s.id)
    ).then((ergebnis) => {
      if (!ergebnis.ok) setFehler(ergebnis.fehler);
    });
  }

  function handleHinzufuegen(songId: string) {
    const song = katalog.find((s) => s.id === songId);
    if (!song || gewaehlteIds.has(songId)) return;
    setFehler(null);
    speichern([...songs, song]);
  }

  function handleEntfernen(songId: string) {
    setFehler(null);
    speichern(songs.filter((s) => s.id !== songId));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className={clsx(
            "text-xs font-medium",
            aufDunkel ? "text-slate-200" : "text-slate-500 dark:text-slate-400"
          )}
        >
          Songs zum Proben
        </span>
        {songs.length > 0 && (
          <span className={clsx("text-xs", aufDunkel ? "text-slate-300" : "text-slate-400")}>
            {formatDauer(gesamt)}
          </span>
        )}
      </div>

      {songs.length > 0 && (
        <ul className="flex flex-col">
          {songs.map((song, index) => (
            <li key={song.id} className="flex items-center gap-2 py-0.5">
              <span className={clsx("w-4 shrink-0 text-xs", aufDunkel ? "text-slate-300" : "text-slate-400")}>
                {index + 1}
              </span>
              <span
                className={clsx(
                  "min-w-0 flex-1 truncate text-sm",
                  aufDunkel ? "text-white" : "text-slate-900 dark:text-slate-100"
                )}
              >
                {song.titel}
                {song.interpret && (
                  <span className={clsx(aufDunkel ? "text-slate-300" : "text-slate-500 dark:text-slate-400")}>
                    {" "}
                    · {song.interpret}
                  </span>
                )}
              </span>
              <span className={clsx("shrink-0 text-xs", aufDunkel ? "text-slate-300" : "text-slate-400")}>
                {formatDauer(song.dauer_sekunden)}
              </span>
              <button
                type="button"
                onClick={() => handleEntfernen(song.id)}
                className={clsx(
                  "shrink-0",
                  aufDunkel
                    ? "text-slate-300 hover:text-red-400"
                    : "text-slate-300 hover:text-red-600"
                )}
                title="Song entfernen"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {auswahl.length > 0 ? (
        <select
          value=""
          onChange={(e) => e.target.value && handleHinzufuegen(e.target.value)}
          className={clsx(
            "w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none",
            aufDunkel
              ? "border-white/30 bg-transparent text-white focus:border-white/60 [&>option]:text-slate-900"
              : "border-slate-300 bg-white text-slate-700 focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          )}
        >
          <option value="">+ Song aus dem Katalog…</option>
          {auswahl.map((song) => (
            <option key={song.id} value={song.id}>
              {song.titel}
              {song.interpret ? ` · ${song.interpret}` : ""}
            </option>
          ))}
        </select>
      ) : (
        songs.length === 0 && (
          <p className={clsx("text-xs", aufDunkel ? "text-slate-300" : "text-slate-500 dark:text-slate-400")}>
            Noch keine Songs im Katalog - im Setliste-Tab anlegen.
          </p>
        )
      )}
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
    </div>
  );
}
