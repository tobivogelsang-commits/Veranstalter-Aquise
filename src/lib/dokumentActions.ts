"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

// Fügt der erweiterbaren Dokument-Liste einer Band einen neuen Typ hinzu
// (z. B. "Vertrag") - ab dann für jeden Veranstalter dieser Band als
// ankreuzbares Dokument verfügbar, wie Vorlagen/Mail-Zugangsdaten eine
// einzige, band-weite Quelle statt pro Veranstalter neu anzulegen.
export async function fuegeDokumentTypHinzu(
  bandId: string,
  name: string,
  venueId: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const bereinigt = name.trim();
  if (!bereinigt) return { ok: false, fehler: "Name fehlt." };

  const { error } = await supabase
    .from("band_dokument_typen")
    .insert({ band_id: bandId, name: bereinigt });

  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/venues/${venueId}`);
  return { ok: true };
}

export async function entferneDokumentTyp(
  dokumentTypId: string,
  venueId: string
) {
  const { error } = await supabase
    .from("band_dokument_typen")
    .delete()
    .eq("id", dokumentTypId);
  if (error) throw new Error(error.message);

  revalidatePath(`/venues/${venueId}`);
}

// Schaltet um, ob ein Dokument als an diesen Veranstalter (für diese Band)
// verschickt markiert ist - setzt/löscht versendet_am statt nur ein
// Boolean, damit man auf einen Blick auch sieht, seit wann.
export async function toggleDokumentVersendet(
  venueId: string,
  bandId: string,
  dokumentTypId: string
) {
  const { data: bestehend } = await supabase
    .from("venue_band_dokumente")
    .select("id, versendet_am")
    .eq("venue_id", venueId)
    .eq("band_id", bandId)
    .eq("dokument_typ_id", dokumentTypId)
    .maybeSingle();

  const neuVersendet = !bestehend?.versendet_am;

  const { error } = await supabase.from("venue_band_dokumente").upsert(
    {
      venue_id: venueId,
      band_id: bandId,
      dokument_typ_id: dokumentTypId,
      versendet_am: neuVersendet ? new Date().toISOString() : null,
    },
    { onConflict: "venue_id,band_id,dokument_typ_id" }
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/venues/${venueId}`);
}
