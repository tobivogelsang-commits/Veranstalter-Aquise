// Songtext-Suche über lrclib.net - frei, ohne Schlüssel und Anmeldung,
// ausdrücklich für Musik-Apps gedacht.
//
// Bewusst NICHT Google oder AZLyrics: Google hat keine Textschnittstelle (die
// Texte in den Suchergebnissen sind zugekauft), und AZLyrics untersagt
// automatisierte Zugriffe und sperrt sie aktiv aus - beides wäre bestenfalls
// kurz gelaufen und dann still gebrochen.
const BASIS = "https://lrclib.net/api";

// Kennzeichnung mit Kontaktweg ist bei frei betriebenen Diensten üblich, damit
// der Betreiber bei auffälligem Verkehr weiss, woher er kommt.
const KENNUNG = "veranstalter-akquise (https://veranstalter-aquise.vercel.app)";

type LrclibTreffer = {
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

export type SongtextErgebnis =
  // sync ist null, wenn es zu diesem Song keine zeitsynchrone Fassung gibt -
  // laengst nicht jeder Eintrag bei lrclib hat eine.
  | { gefunden: true; text: string; sync: string | null }
  | { gefunden: false; grund: "instrumental" | "kein_treffer" | "fehler" };

async function hole(pfad: string): Promise<unknown | null> {
  try {
    const antwort = await fetch(`${BASIS}${pfad}`, {
      headers: { "User-Agent": KENNUNG },
      // Kein Caching durch Next: Das Ergebnis wird ohnehin in der Datenbank
      // abgelegt, ein zweiter Abruf findet gar nicht erst statt.
      cache: "no-store",
    });
    if (!antwort.ok) return null;
    return await antwort.json();
  } catch {
    return null;
  }
}

function brauchbar(treffer: LrclibTreffer): boolean {
  return Boolean(treffer.plainLyrics && treffer.plainLyrics.trim());
}

export async function sucheSongtext(
  titel: string,
  interpret: string | null,
  dauerSekunden: number | null
): Promise<SongtextErgebnis> {
  const suchbegriffe = new URLSearchParams({ track_name: titel });
  if (interpret) suchbegriffe.set("artist_name", interpret);

  // Erst der exakte Abgleich: Mit Dauer trifft lrclib die richtige Fassung
  // deutlich zuverlässiger (es toleriert ein paar Sekunden Abweichung).
  if (dauerSekunden) {
    const genau = new URLSearchParams(suchbegriffe);
    genau.set("duration", String(dauerSekunden));
    const treffer = (await hole(`/get?${genau}`)) as LrclibTreffer | null;
    if (treffer?.instrumental) return { gefunden: false, grund: "instrumental" };
    if (treffer && brauchbar(treffer)) {
      return {
        gefunden: true,
        text: treffer.plainLyrics!.trim(),
        sync: treffer.syncedLyrics?.trim() || null,
      };
    }
  }

  const liste = (await hole(`/search?${suchbegriffe}`)) as LrclibTreffer[] | null;
  if (!Array.isArray(liste)) return { gefunden: false, grund: "fehler" };

  const mitText = liste.filter(brauchbar);
  if (mitText.length === 0) {
    // Nur Instrumental-Treffer? Dann ist das die Antwort, nicht "nichts da".
    return liste.some((t) => t.instrumental)
      ? { gefunden: false, grund: "instrumental" }
      : { gefunden: false, grund: "kein_treffer" };
  }

  // Die Suche liefert oft dieselbe Fassung mehrfach. Treffer MIT Zeitmarken
  // haben Vorrang: Der reine Text ist derselbe, die synchrone Fassung kann
  // aber zusaetzlich auf der Buehne mitlaufen.
  const mitSync = mitText.filter((t) => t.syncedLyrics?.trim());
  const auswahl = mitSync.length > 0 ? mitSync : mitText;

  // Wenn die Dauer bekannt ist, gewinnt der Treffer, der ihr am naechsten
  // kommt - sonst der erste.
  const bester = dauerSekunden
    ? auswahl.reduce((a, b) =>
        Math.abs((a.duration ?? 0) - dauerSekunden) <=
        Math.abs((b.duration ?? 0) - dauerSekunden)
          ? a
          : b
      )
    : auswahl[0];

  return {
    gefunden: true,
    text: bester.plainLyrics!.trim(),
    sync: bester.syncedLyrics?.trim() || null,
  };
}
