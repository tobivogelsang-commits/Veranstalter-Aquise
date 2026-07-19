"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

// Fügt dem Protokoll eines Veranstalters (für eine bestimmte Band) einen
// manuellen Eintrag hinzu, z.B. "Anrufversuch" oder "Notiz". Automatische
// Einträge (E-Mail verschickt/beantwortet) landen über emailActions.ts direkt
// in derselben Tabelle.
export async function fuegeProtokollEintragHinzu(
  venueId: string,
  bandId: string,
  typ: string,
  text: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const bereinigt = text.trim();
  if (!bereinigt) return { ok: false, fehler: "Text fehlt." };

  const { error } = await supabase.from("venue_band_protokoll").insert({
    venue_id: venueId,
    band_id: bandId,
    typ,
    text: bereinigt,
  });

  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/venues/${venueId}`);
  return { ok: true };
}
