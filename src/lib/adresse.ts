// Extrahiert "Straße Hausnummer" aus Freitext (z. B. Google-Adressfeldern
// oder Recherche-Ausschnitten wie "Rathausstraße 3, Kaarst" oder
// "Postanschrift: ... Postfach 15 65 40740 Langenfeld."). Reine Heuristik:
// sucht alle "Wort Zahl"-Vorkommen und nimmt das erste, dessen Wort auf eine
// typische Straßen-Endung ausläuft - ein Postfach o. Ä. fällt so zuverlässig
// heraus, ohne dass die Straße vorher bekannt sein muss.

const STRASSEN_SUFFIXE = [
  "straße",
  "strasse",
  "str.",
  "str",
  "weg",
  "allee",
  "platz",
  "gasse",
  "ring",
  "damm",
  "ufer",
  "steig",
  "pfad",
  "chaussee",
  "markt",
];

export function extrahiereStrasse(text: string | null | undefined): string | null {
  if (!text) return null;

  const regex =
    /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.-]{2,})\s+(\d{1,4}\s?[a-zA-Z]?(?:\s*[-–]\s*\d{1,4}\s?[a-zA-Z]?)?)/g;

  let treffer: RegExpExecArray | null;
  while ((treffer = regex.exec(text))) {
    const wort = treffer[1].toLowerCase().replace(/\.$/, "");
    const istStrasse = STRASSEN_SUFFIXE.some((suffix) =>
      wort.endsWith(suffix.replace(/\.$/, ""))
    );
    if (istStrasse) {
      return `${treffer[1]} ${treffer[2]}`.replace(/\s+/g, " ").trim();
    }
  }

  // Sonderfall "Platz": steht bei benannten Plätzen oft als erstes Wort statt
  // als Endung (z. B. "Platz d. Guten Hoffnung 1a", "Platz der Republik 1") -
  // das obige Endungs-Muster greift hier nicht, da "Republik"/"Hoffnung" nicht
  // auf "platz" endet.
  const praefixTreffer = text.match(
    /\bPlatz\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.\s-]{1,40}?\s+(\d{1,4}\s?[a-zA-Z]?(?:\s*[-–]\s*\d{1,4}\s?[a-zA-Z]?)?)/i
  );
  if (praefixTreffer) {
    return praefixTreffer[0].replace(/\s+/g, " ").trim();
  }

  return null;
}
