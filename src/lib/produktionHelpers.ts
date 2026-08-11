import type { ProduktionMitSong } from "@/lib/types";

// Reihenfolge der Produktions-Liste, von oben nach unten:
//  1. laufende Arbeiten - darin: noch unbenotete zuerst (sie brauchen ja gerade
//     eine Einordnung), dann nach Note aufsteigend (1 = gut steht oben, 6 unten
//     und bekommt so bewusst weniger Aufmerksamkeit).
//  2. bereits in den Songkatalog übernommene Produktionen ans Ende - die sind
//     fertig. Diese Regel steht ÜBER der Note, sonst spränge ein fertiger Song
//     mit Note 1 wieder nach ganz oben.
//
// Bei gleicher Note bleibt die vorhandene Reihenfolge erhalten (Array.sort ist
// stabil) - serverseitig ist das "neueste zuerst", weil die Query bereits nach
// erstellt_am absteigend sortiert.
//
// Bewusst hier und nicht in queries.ts: Der Client sortiert nach einer
// Notenvergabe sofort selbst um, und beide Seiten müssen dieselbe Reihenfolge
// ergeben - sonst springt die Liste beim nächsten Laden unerwartet um.
export function sortiereProduktionen(
  liste: ProduktionMitSong[]
): ProduktionMitSong[] {
  const nachNote = (teil: ProduktionMitSong[]) =>
    [...teil].sort((a, b) => (a.note ?? 0) - (b.note ?? 0));

  return [
    ...nachNote(liste.filter((p) => !p.song_id)),
    ...nachNote(liste.filter((p) => p.song_id)),
  ];
}
