"use client";

import { useEffect, useState } from "react";
import { holeSongtext, speichereSongtext } from "@/lib/setlistActions";
import type { BandSong } from "@/lib/types";

// Schriftgrössen für die Bühne. Die Auswahl bleibt auf dem Gerät gespeichert -
// wer einmal seinen Abstand zum Handy gefunden hat, will ihn nicht bei jedem
// Song neu einstellen.
const GROESSEN = ["text-xl", "text-2xl", "text-3xl", "text-4xl", "text-5xl"];
const GROESSE_SPEICHER = "songtext-groesse";
// Startgrösse bewusst weit oben: Der Zweck ist Ablesen aus ein paar Metern
// Abstand. Wer es kleiner mag, stellt einmal um - das bleibt gespeichert.
const STANDARD_STUFE = 2;

export function SongtextModal({
  song,
  bandId,
  onSchliessen,
}: {
  song: BandSong;
  bandId: string;
  onSchliessen: () => void;
}) {
  const [text, setText] = useState<string | null>(song.songtext);
  const [hinweis, setHinweis] = useState<string | null>(null);
  // Startwert: Fehlt der Text noch, laeuft die Suche sofort los - dann soll
  // gleich der Ladehinweis stehen, nicht erst nach einem Zwischenrender.
  const [laedt, setLaedt] = useState(!song.songtext);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState("");
  // Gemerkte Groesse direkt als Startwert lesen. Das Fenster entsteht erst
  // nach einem Klick, also nie beim serverseitigen Rendern - ein Abgleich-
  // Problem beim Hydrieren kann es hier nicht geben.
  const [stufe, setStufe] = useState(() => {
    if (typeof window === "undefined") return STANDARD_STUFE;
    // Achtung: Number(null) ist 0 - ohne diese Prüfung startet die Ansicht
    // beim allerersten Öffnen auf der KLEINSTEN Stufe statt auf der grossen.
    const roh = window.localStorage.getItem(GROESSE_SPEICHER);
    if (roh === null) return STANDARD_STUFE;
    const gemerkt = Number(roh);
    return Number.isInteger(gemerkt) && gemerkt >= 0 && gemerkt < GROESSEN.length
      ? gemerkt
      : STANDARD_STUFE;
  });

  // Text erst beim Öffnen holen, nicht auf Vorrat für den ganzen Katalog: Das
  // wären für eine Setliste zwanzig Abfragen, von denen die meisten niemand
  // liest. Einmal geholt, liegt er in der Datenbank.
  useEffect(() => {
    if (song.songtext) return;
    let abgebrochen = false;
    holeSongtext(song.id, bandId)
      .then((ergebnis) => {
        if (abgebrochen) return;
        if (!ergebnis.ok) return setHinweis(ergebnis.fehler);
        setText(ergebnis.text);
        setHinweis(ergebnis.hinweis);
      })
      .finally(() => !abgebrochen && setLaedt(false));
    return () => {
      abgebrochen = true;
    };
  }, [song.id, song.songtext, bandId]);

  // Auf der Bühne wird nicht getippt - Escape reicht am Rechner, auf dem Handy
  // gibt es den Schliessen-Knopf.
  useEffect(() => {
    function beiTaste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliessen();
    }
    document.addEventListener("keydown", beiTaste);
    return () => document.removeEventListener("keydown", beiTaste);
  }, [onSchliessen]);

  function setzeStufe(neu: number) {
    const begrenzt = Math.min(GROESSEN.length - 1, Math.max(0, neu));
    setStufe(begrenzt);
    window.localStorage.setItem(GROESSE_SPEICHER, String(begrenzt));
  }

  async function erneutSuchen() {
    setLaedt(true);
    setHinweis(null);
    const ergebnis = await holeSongtext(song.id, bandId, true);
    setLaedt(false);
    if (!ergebnis.ok) return setHinweis(ergebnis.fehler);
    setText(ergebnis.text);
    setHinweis(ergebnis.hinweis);
  }

  async function speichern() {
    const ergebnis = await speichereSongtext(song.id, bandId, entwurf);
    if (!ergebnis.ok) return setHinweis(ergebnis.fehler);
    setText(entwurf.trim() || null);
    setBearbeiten(false);
    setHinweis(null);
  }

  return (
    // Bewusst immer dunkel, unabhängig vom Modus der App: geringere Blendung
    // auf einer dunklen Bühne und besserer Kontrast für Text aus der Distanz.
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100">
      <div className="flex items-start gap-3 border-b border-slate-800 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{song.titel}</p>
          {song.interpret && (
            <p className="truncate text-xs text-slate-400">{song.interpret}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setzeStufe(stufe - 1)}
            disabled={stufe === 0}
            className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-30"
            aria-label="Schrift kleiner"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => setzeStufe(stufe + 1)}
            disabled={stufe === GROESSEN.length - 1}
            className="rounded border border-slate-700 px-2 py-1 text-sm disabled:opacity-30"
            aria-label="Schrift größer"
          >
            A+
          </button>
          <button
            type="button"
            onClick={onSchliessen}
            className="ml-1 rounded border border-slate-700 px-3 py-1 text-sm"
          >
            Fertig
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        {laedt && <p className="text-sm text-slate-400">Text wird gesucht …</p>}

        {!laedt && bearbeiten && (
          <div className="flex flex-col gap-3">
            <textarea
              value={entwurf}
              onChange={(e) => setEntwurf(e.target.value)}
              rows={18}
              className="w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-sm leading-relaxed text-slate-100"
              placeholder="Songtext …"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={speichern}
                className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900"
              >
                Speichern
              </button>
              <button
                type="button"
                onClick={() => setBearbeiten(false)}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {!laedt && !bearbeiten && text && (
          // whitespace-pre-wrap: Der Text kommt mit eigenen Zeilenumbrüchen,
          // die genau die Versstruktur tragen.
          <p className={`whitespace-pre-wrap leading-relaxed ${GROESSEN[stufe]}`}>
            {text}
          </p>
        )}

        {!laedt && !bearbeiten && !text && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-slate-400">
              {hinweis ?? "Noch kein Text hinterlegt."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={erneutSuchen}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm"
              >
                Nochmal suchen
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntwurf("");
                  setBearbeiten(true);
                }}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm"
              >
                Selbst eintragen
              </button>
            </div>
          </div>
        )}
      </div>

      {!bearbeiten && text && (
        <div className="border-t border-slate-800 px-4 py-2">
          <button
            type="button"
            onClick={() => {
              setEntwurf(text);
              setBearbeiten(true);
            }}
            className="text-xs text-slate-400 underline"
          >
            Text bearbeiten
          </button>
        </div>
      )}
    </div>
  );
}
