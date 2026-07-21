import type { BandSong } from "@/lib/types";
import type { SetlistPause } from "@/lib/database.types";

export type SetSegment = {
  nummer: number;
  start: string; // "HH:MM"
  ende: string; // "HH:MM"
  songAnzahl: number;
  pauseDanachMin: number | null; // Pause im Anschluss an dieses Set, falls vorhanden
};

export type SetZeiten = {
  sets: SetSegment[];
  ende: string; // Gesamtende ("HH:MM")
  fehlendeDauern: boolean; // mindestens ein Song ohne hinterlegte Dauer -> Zeiten sind untere Schranke
};

// "20:00" -> 1200 (Minuten seit Mitternacht). null bei ungültiger Eingabe.
function parseHhMm(zeit: string | null | undefined): number | null {
  if (!zeit) return null;
  const [h, m] = zeit.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatMinuten(minutenAmTag: number): string {
  const normalisiert = ((minutenAmTag % 1440) + 1440) % 1440;
  const h = Math.floor(normalisiert / 60);
  const m = normalisiert % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Berechnet Start-/Endzeit je Set aus Auftrittsbeginn, Songdauern und Pausen.
// Ein "Set" ist eine zusammenhängende Songfolge; jede Pause (nach_index)
// beendet das laufende Set und verschiebt den Start des nächsten. Songdauern
// werden auf ganze Minuten aufgerundet, Pausen sind bereits in Minuten.
// Gibt null zurück, wenn kein gültiger Beginn oder keine Songs vorliegen.
export function berechneSetZeiten(
  beginn: string | null | undefined,
  songs: BandSong[],
  pausen: SetlistPause[]
): SetZeiten | null {
  const startMin = parseHhMm(beginn);
  if (startMin === null || songs.length === 0) return null;

  const pauseNachIndex = new Map<number, number>();
  for (const p of pausen) {
    if (p && Number.isFinite(p.nach_index) && Number.isFinite(p.minuten)) {
      pauseNachIndex.set(p.nach_index, (pauseNachIndex.get(p.nach_index) ?? 0) + p.minuten);
    }
  }

  const sets: SetSegment[] = [];
  let fehlendeDauern = false;
  let aktuelleZeit = startMin;
  let setStart = startMin;
  let songImSet = 0;

  const setAbschliessen = (pauseDanach: number | null) => {
    sets.push({
      nummer: sets.length + 1,
      start: formatMinuten(setStart),
      ende: formatMinuten(aktuelleZeit),
      songAnzahl: songImSet,
      pauseDanachMin: pauseDanach,
    });
  };

  songs.forEach((song, index) => {
    if (song.dauer_sekunden === null) fehlendeDauern = true;
    aktuelleZeit += Math.ceil((song.dauer_sekunden ?? 0) / 60);
    songImSet += 1;

    const pause = pauseNachIndex.get(index);
    const istLetzter = index === songs.length - 1;
    if (pause !== undefined && !istLetzter) {
      setAbschliessen(pause);
      aktuelleZeit += pause;
      setStart = aktuelleZeit;
      songImSet = 0;
    }
  });

  if (songImSet > 0) setAbschliessen(null);

  return { sets, ende: formatMinuten(aktuelleZeit), fehlendeDauern };
}

// true, wenn das berechnete Ende nach der erlaubten Endzeit liegt.
export function ueberschreitetEnde(
  berechnetesEnde: string,
  erlaubtesEnde: string | null | undefined
): boolean {
  const ende = parseHhMm(berechnetesEnde);
  const grenze = parseHhMm(erlaubtesEnde);
  if (ende === null || grenze === null) return false;
  return ende > grenze;
}
