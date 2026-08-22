"use server";

import { revalidatePath } from "next/cache";
// service_role-Client (umgeht RLS). Wie bei den Setlist-Aktionen bewusst auch
// aus der öffentlichen Team-App (ProduktionListe) nutzbar - daher KEIN
// requireAnmeldung(); Schutz ist die nicht erratbare Band-UUID.
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import {
  PRODUKTION_NOTEN,
  PRODUKTION_RECORDINGS,
  PRODUKTION_STEPS,
} from "@/lib/constants";
import type { ProduktionRecording, ProduktionStep } from "@/lib/database.types";
import type { Produktion } from "@/lib/types";

// Jede Aktion filtert zusaetzlich nach band_id: die bandId kam bisher nur fuer
// revalidatePath mit, sodass die Kenntnis einer fremden Produktions-ID
// genuegte, um sie zu aendern, zu loeschen oder in den eigenen Katalog zu
// uebernehmen. "Nicht gefunden" deckt beide Faelle ab (existiert nicht /
// fremde Band), damit die Antwort fremde IDs nicht bestaetigt.
const FREMD = "Nicht gefunden.";

// Nur erlaubte Werte durchlassen (Client schickt zwar nur gültige, aber die
// Aktion ist öffentlich erreichbar).
function bereinigeStep(step: string | null): ProduktionStep | null {
  return step && (PRODUKTION_STEPS as string[]).includes(step)
    ? (step as ProduktionStep)
    : null;
}

// Nur 1-6 durchlassen (die Aktion ist oeffentlich erreichbar); alles andere
// gilt als "nicht bewertet". Die DB lehnt Abweichungen zusaetzlich per
// CHECK-Constraint ab.
function bereinigeNote(note: number | null): number | null {
  return note !== null && (PRODUKTION_NOTEN as readonly number[]).includes(note)
    ? note
    : null;
}

function bereinigeRecordings(recordings: string[]): ProduktionRecording[] {
  const erlaubt = new Set<string>(PRODUKTION_RECORDINGS);
  // Reihenfolge aus PRODUKTION_RECORDINGS erzwingen, Duplikate entfernen.
  return PRODUKTION_RECORDINGS.filter(
    (r) => recordings.includes(r) && erlaubt.has(r)
  );
}

// `name` ist optional: Über "+ Neuer Eintrag" im Produktion-Tab entsteht ein
// leerer Eintrag, über "+ zur Produktion" im Setliste-Tab dagegen einer mit
// vorbelegtem Speichernamen (Titel + Interpret des gesuchten Songs).
export async function erstelleProduktion(
  bandId: string,
  name?: string
): Promise<{ ok: true; produktion: Produktion } | { ok: false; fehler: string }> {
  const { data, error } = await supabase
    .from("produktionen")
    .insert({ band_id: bandId, ...(name?.trim() ? { name: name.trim() } : {}) })
    .select("*")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/produktion/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true, produktion: data };
}

export async function aktualisiereProduktion(
  produktionId: string,
  bandId: string,
  werte: {
    name: string;
    datum: string;
    step: string | null;
    recordings: string[];
    note: number | null;
  }
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { data, error } = await supabase
    .from("produktionen")
    .update({
      name: werte.name,
      datum: werte.datum,
      step: bereinigeStep(werte.step),
      recordings: bereinigeRecordings(werte.recordings),
      note: bereinigeNote(werte.note),
    })
    .eq("id", produktionId)
    .eq("band_id", bandId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, fehler: error.message };
  if (!data) return { ok: false, fehler: FREMD };

  revalidatePath(`/produktion/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true };
}

// Loeschen ist absichtlich idempotent: trifft der band_id-Filter nichts (ID
// existiert nicht oder gehoert einer anderen Band), wird nichts geloescht und
// trotzdem Erfolg gemeldet. Das verraet einem Fremden nicht, ob eine ID
// existiert, und ein zweiter Klick / zweites Geraet laeuft nicht in einen
// Fehler.
export async function loescheProduktion(produktionId: string, bandId: string) {
  const { error } = await supabase
    .from("produktionen")
    .delete()
    .eq("id", produktionId)
    .eq("band_id", bandId);
  if (error) throw new Error(error.message);

  revalidatePath(`/produktion/${bandId}`);
  revalidatePath(`/team/${bandId}`);
}

// Überführt eine fertige Produktion in den Songkatalog: legt den Song an und
// merkt ihn sich an der Produktion. Titel und Interpret kommen aus dem
// Formular, weil der Arbeitstitel ("BlBl176") selten der spätere Songtitel
// ("How I Get") ist und bei Eigenkompositionen die Band selbst der Interpret
// ist. Bewusst ohne requireAnmeldung - wie die übrigen Produktions-Aktionen auch
// aus der Team-App nutzbar.
export async function uebernehmeInKatalog(
  produktionId: string,
  bandId: string,
  titel: string,
  interpret: string | null,
  dauerSekunden: number | null
): Promise<
  { ok: true; song: { id: string; titel: string } } | { ok: false; fehler: string }
> {
  const bereinigt = titel.trim();
  if (!bereinigt) return { ok: false, fehler: "Titel fehlt." };

  // Doppelte Übernahme verhindern (z. B. bei zwei offenen Geräten).
  const { data: bestehende } = await supabase
    .from("produktionen")
    .select("song_id")
    .eq("id", produktionId)
    .eq("band_id", bandId)
    .maybeSingle();
  if (!bestehende) return { ok: false, fehler: FREMD };
  if (bestehende.song_id) {
    return { ok: false, fehler: "Diese Produktion ist bereits im Katalog." };
  }

  const { data: song, error: songFehler } = await supabase
    .from("band_songs")
    .insert({
      band_id: bandId,
      titel: bereinigt,
      interpret: interpret?.trim() || null,
      dauer_sekunden: dauerSekunden,
    })
    .select("id, titel")
    .single();
  if (songFehler) return { ok: false, fehler: songFehler.message };

  const { error } = await supabase
    .from("produktionen")
    .update({ song_id: song.id })
    .eq("id", produktionId)
    .eq("band_id", bandId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/produktion/${bandId}`);
  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true, song };
}
