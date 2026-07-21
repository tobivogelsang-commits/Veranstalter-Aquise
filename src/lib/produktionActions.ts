"use server";

import { revalidatePath } from "next/cache";
// service_role-Client (umgeht RLS). Wie bei den Setlist-Aktionen bewusst auch
// aus der öffentlichen Team-App (ProduktionListe) nutzbar - daher KEIN
// requireOwner(); Schutz ist die nicht erratbare Band-UUID.
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { PRODUKTION_RECORDINGS, PRODUKTION_STEPS } from "@/lib/constants";
import type { ProduktionRecording, ProduktionStep } from "@/lib/database.types";
import type { Produktion } from "@/lib/types";

// Nur erlaubte Werte durchlassen (Client schickt zwar nur gültige, aber die
// Aktion ist öffentlich erreichbar).
function bereinigeStep(step: string | null): ProduktionStep | null {
  return step && (PRODUKTION_STEPS as string[]).includes(step)
    ? (step as ProduktionStep)
    : null;
}

function bereinigeRecordings(recordings: string[]): ProduktionRecording[] {
  const erlaubt = new Set<string>(PRODUKTION_RECORDINGS);
  // Reihenfolge aus PRODUKTION_RECORDINGS erzwingen, Duplikate entfernen.
  return PRODUKTION_RECORDINGS.filter(
    (r) => recordings.includes(r) && erlaubt.has(r)
  );
}

export async function erstelleProduktion(
  bandId: string
): Promise<{ ok: true; produktion: Produktion } | { ok: false; fehler: string }> {
  const { data, error } = await supabase
    .from("produktionen")
    .insert({ band_id: bandId })
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
  }
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { error } = await supabase
    .from("produktionen")
    .update({
      name: werte.name,
      datum: werte.datum,
      step: bereinigeStep(werte.step),
      recordings: bereinigeRecordings(werte.recordings),
    })
    .eq("id", produktionId);

  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/produktion/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true };
}

export async function loescheProduktion(produktionId: string, bandId: string) {
  const { error } = await supabase.from("produktionen").delete().eq("id", produktionId);
  if (error) throw new Error(error.message);

  revalidatePath(`/produktion/${bandId}`);
  revalidatePath(`/team/${bandId}`);
}
