// Prüfungen gegen die Sperrliste (Werbewidersprüche).
//
// Internes Server-Modul, KEIN Aktions-Endpunkt: Als Server Action wäre jede
// Funktion hier über ihre Kennung von außen aufrufbar und würde verraten, wer
// auf der Liste steht. "server-only" lässt den Build scheitern, falls die Datei
// je in eine Client-Komponente importiert wird.
import "server-only";

import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export type Sperreintrag = {
  id: string;
  band_id: string;
  venue_id: string | null;
  email: string | null;
  name: string | null;
  ort: string | null;
  grund: string | null;
  erstellt_am: string;
};

export type Kontaktmerkmale = {
  email?: string | null;
  name?: string | null;
  ort?: string | null;
};

// Einheitlich kleingeschrieben und ohne Rand-Leerzeichen - so wird auch
// gespeichert, damit der Vergleich ohne Funktionen im WHERE auskommt.
export function normalisiere(wert: string | null | undefined): string | null {
  const sauber = wert?.trim().toLowerCase();
  return sauber ? sauber : null;
}

// Alle Sperren, die auf diesen Kontakt passen - über ALLE Bands. Der Aufrufer
// entscheidet, was davon blockiert (eigene Band) und was nur als Hinweis dient
// (andere Band).
//
// Zwei Wege der Erkennung, weil beide Situationen vorkommen: Beim Mailversand
// steht die Adresse fest; bei einem frischen Recherche-Treffer gibt es oft nur
// Name und Ort. Der Ort zählt nur mit, wenn er auf BEIDEN Seiten bekannt ist -
// sonst würde ein Eintrag ohne Ort nie greifen.
export async function findeSperren(
  merkmale: Kontaktmerkmale
): Promise<Sperreintrag[]> {
  const email = normalisiere(merkmale.email);
  const name = normalisiere(merkmale.name);
  const ort = normalisiere(merkmale.ort);
  if (!email && !name) return [];

  const bedingungen: string[] = [];
  if (email) bedingungen.push(`email.eq.${email}`);
  if (name) bedingungen.push(`name.eq.${name}`);

  const { data, error } = await supabase
    .from("sperrliste")
    .select("*")
    .or(bedingungen.join(","));
  if (error) return [];

  return (data ?? []).filter((eintrag) => {
    if (email && eintrag.email === email) return true;
    if (!name || eintrag.name !== name) return false;
    // Namensgleichheit allein reicht nur, wenn kein Ort dagegen spricht.
    // "Stadthalle" gibt es in jeder zweiten Stadt.
    return !eintrag.ort || !ort || eintrag.ort === ort;
  });
}

// Sperrt dieser Kontakt das Anschreiben DURCH DIESE BAND?
export async function istGesperrt(
  bandId: string,
  merkmale: Kontaktmerkmale
): Promise<Sperreintrag | null> {
  const treffer = await findeSperren(merkmale);
  return treffer.find((e) => e.band_id === bandId) ?? null;
}
