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
