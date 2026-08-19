// LRC-Format: Jede Zeile beginnt mit "[mm:ss.xx]" (Hundertstel optional),
// danach der Text. Zeilen ohne Zeitmarke sind Kopfangaben (z. B. "[ar:...]")
// und werden übersprungen.
export type SyncZeile = { zeitMs: number; text: string };

const ZEILE = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\](.*)$/;

export function parseLrc(roh: string): SyncZeile[] {
  const zeilen: SyncZeile[] = [];

  for (const zeile of roh.split(/\r?\n/)) {
    const treffer = ZEILE.exec(zeile.trim());
    if (!treffer) continue;
    const [, min, sek, bruch, text] = treffer;
    // Bruchteil auf Millisekunden bringen: "5" -> 500, "52" -> 520, "523" -> 523.
    const ms = bruch ? Number(bruch.padEnd(3, "0")) : 0;
    zeilen.push({
      zeitMs: Number(min) * 60000 + Number(sek) * 1000 + ms,
      text: text.trim(),
    });
  }

  return zeilen.sort((a, b) => a.zeitMs - b.zeitMs);
}

// Index der Zeile, die zum Zeitpunkt gilt - also die letzte, deren Marke schon
// erreicht ist. -1, solange der Song noch im Vorspann ist.
export function aktiveZeile(zeilen: SyncZeile[], zeitMs: number): number {
  let treffer = -1;
  for (let i = 0; i < zeilen.length; i++) {
    if (zeilen[i].zeitMs <= zeitMs) treffer = i;
    else break;
  }
  return treffer;
}

// Zeitmarken aus einer eingelernten oder korrigierten Fassung wieder als LRC
// schreiben - dieselbe Form, die lrclib liefert.
export function bauLrc(zeilen: SyncZeile[]): string {
  return zeilen
    .map(({ zeitMs, text }) => {
      // Durchgehend in Ganzzahlen rechnen. Der Umweg ueber Sekunden als
      // Kommazahl verschiebt sonst einzelne Marken um eine Hundertstelsekunde
      // (76,71 s wird intern zu 7670,999..., abgerundet also 70 statt 71).
      const hundertstelGesamt = Math.round(Math.max(0, zeitMs) / 10);
      const min = Math.floor(hundertstelGesamt / 6000);
      const rest = hundertstelGesamt % 6000;
      const zz = (n: number) => String(n).padStart(2, "0");
      return `[${zz(min)}:${zz(Math.floor(rest / 100))}.${zz(rest % 100)}]${text}`;
    })
    .join("\n");
}

// Wendet Tempo und Versatz auf die Zeitmarken an.
//
// tempo ist Prozent des Original-Tempos: 105 heisst "wir spielen 5 % schneller",
// die Zeilen kommen also FRUEHER - daher wird durch den Faktor geteilt, nicht
// multipliziert. versatzMs verschiebt anschliessend alles gleichmaessig, etwa
// wenn das Intro kuerzer ist.
export function mitTiming(
  zeilen: SyncZeile[],
  versatzMs: number,
  tempo: number
): SyncZeile[] {
  const faktor = tempo > 0 ? 100 / tempo : 1;
  if (faktor === 1 && versatzMs === 0) return zeilen;
  return zeilen.map((z) => ({
    ...z,
    zeitMs: Math.round(z.zeitMs * faktor) + versatzMs,
  }));
}
