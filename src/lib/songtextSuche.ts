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

// Interpreten-Schreibweisen, die nacheinander probiert werden. Steht in den
// Songdaten eine Aufzaehlung ("Gala, Motella, Phil Jay" - Remix-Beteiligte),
// findet lrclib damit nichts; mit dem ersten Namen allein schon. Der zweite
// Versuch erspart es, gepflegte Angaben in den Songdaten zu verstuemmeln.
function interpretVarianten(interpret: string | null): (string | null)[] {
  if (!interpret) return [null];
  const erster = interpret.split(/[,&]|\bfeat\.?\b|\bft\.?\b/i)[0].trim();
  return erster && erster !== interpret ? [interpret, erster] : [interpret];
}

export async function sucheSongtext(
  titel: string,
  interpret: string | null,
  dauerSekunden: number | null
): Promise<SongtextErgebnis> {
  const varianten = interpretVarianten(interpret);

  // Erst der exakte Abgleich: Mit Dauer trifft lrclib die richtige Fassung
  // deutlich zuverlässiger (es toleriert ein paar Sekunden Abweichung).
  //
  // Liefert er allerdings eine Fassung OHNE Zeitmarken, wird sie nur gemerkt
  // und die Suche trotzdem noch gefahren: Oft gibt es dieselbe Fassung mit
  // Zeitmarken, und die ist auf der Bühne mehr wert. Erst wenn auch dort
  // nichts Besseres auftaucht, greift der gemerkte Treffer.
  let ohneZeitmarken: LrclibTreffer | null = null;

  if (dauerSekunden) {
    for (const variante of varianten) {
      const genau = new URLSearchParams({ track_name: titel });
      if (variante) genau.set("artist_name", variante);
      genau.set("duration", String(dauerSekunden));
      const treffer = (await hole(`/get?${genau}`)) as LrclibTreffer | null;
      if (treffer?.instrumental) return { gefunden: false, grund: "instrumental" };
      if (treffer && brauchbar(treffer)) {
        if (treffer.syncedLyrics?.trim()) {
          return {
            gefunden: true,
            text: treffer.plainLyrics!.trim(),
            sync: treffer.syncedLyrics.trim(),
          };
        }
        ohneZeitmarken ??= treffer;
      }
    }
  }

  let liste: LrclibTreffer[] | null = null;
  for (const variante of varianten) {
    const suchbegriffe = new URLSearchParams({ track_name: titel });
    if (variante) suchbegriffe.set("artist_name", variante);
    const antwort = (await hole(`/search?${suchbegriffe}`)) as LrclibTreffer[] | null;
    if (Array.isArray(antwort) && antwort.some(brauchbar)) {
      liste = antwort;
      break;
    }
    if (Array.isArray(antwort) && !liste) liste = antwort;
  }
  if (!Array.isArray(liste)) return { gefunden: false, grund: "fehler" };

  const mitText = liste.filter(brauchbar);
  if (mitText.length === 0) {
    // Nichts Besseres gefunden - dann doch der exakte Treffer ohne Zeitmarken.
    if (ohneZeitmarken) {
      return {
        gefunden: true,
        text: ohneZeitmarken.plainLyrics!.trim(),
        sync: null,
      };
    }
    // Nur Instrumental-Treffer? Dann ist das die Antwort, nicht "nichts da".
    return liste.some((t) => t.instrumental)
      ? { gefunden: false, grund: "instrumental" }
      : { gefunden: false, grund: "kein_treffer" };
  }

  // Die Suche liefert oft dieselbe Fassung mehrfach. Treffer MIT Zeitmarken
  // haben Vorrang: Der reine Text ist derselbe, die synchrone Fassung kann
  // aber zusaetzlich auf der Buehne mitlaufen.
  const mitSync = mitText.filter((t) => t.syncedLyrics?.trim());
  // Hat auch die Suche keine Zeitmarken, war der exakte Treffer ueber die
  // Dauer die genauere Fassung - dann diesen nehmen.
  if (mitSync.length === 0 && ohneZeitmarken) {
    return {
      gefunden: true,
      text: ohneZeitmarken.plainLyrics!.trim(),
      sync: null,
    };
  }
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
