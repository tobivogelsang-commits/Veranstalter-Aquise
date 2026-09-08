"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { requireFreigabe } from "@/lib/authServer";
import { findeSperren, normalisiere, type Sperreintrag } from "@/lib/sperrliste";

export type SperrlisteEintragMitBand = Sperreintrag & { bandName: string | null };

// Trägt einen Werbewiderspruch ein. venueId ist optional: Ein Widerspruch kann
// auch telefonisch kommen, bevor der Absender überhaupt in der Datenbank steht.
export async function sperreKontakt(
  bandId: string,
  merkmale: { email?: string | null; name?: string | null; ort?: string | null },
  grund: string | null,
  venueId?: string | null
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireFreigabe("akquise");

  const email = normalisiere(merkmale.email);
  const name = normalisiere(merkmale.name);
  if (!email && !name) {
    return { ok: false, fehler: "Mindestens E-Mail oder Name angeben." };
  }

  // Doppelte Einträge derselben Band vermeiden - der Widerspruch wirkt sonst
  // nicht anders, die Liste wird nur unübersichtlich.
  const vorhanden = (await findeSperren({ email, name, ort: merkmale.ort })).find(
    (e) => e.band_id === bandId
  );
  if (vorhanden) return { ok: true };

  const { error } = await supabase.from("sperrliste").insert({
    band_id: bandId,
    venue_id: venueId ?? null,
    email,
    name,
    ort: normalisiere(merkmale.ort),
    grund: grund?.trim() || null,
  });
  if (error) return { ok: false, fehler: error.message };

  revalidatePath("/venues");
  revalidatePath("/pipeline");
  revalidatePath("/sperrliste");
  if (venueId) revalidatePath(`/venues/${venueId}`);
  return { ok: true };
}

// Widerspruch zurücknehmen - etwa wenn sich jemand später doch wieder meldet.
// Der Eintrag verschwindet dabei ganz; ein "aufgehoben"-Vermerk waere zwar
// lueckenloser, wuerde aber Daten von Menschen aufbewahren, die gerade
// ausdruecklich nicht mehr gefuehrt werden wollen.
export async function hebeSperreAuf(
  sperrId: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireFreigabe("akquise");

  const { error } = await supabase.from("sperrliste").delete().eq("id", sperrId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath("/venues");
  revalidatePath("/pipeline");
  revalidatePath("/sperrliste");
  return { ok: true };
}

// Für die Verwaltungsseite: alle Einträge mit Bandnamen, neueste zuerst.
export async function holeSperrliste(): Promise<SperrlisteEintragMitBand[]> {
  await requireFreigabe("akquise");

  const { data, error } = await supabase
    .from("sperrliste")
    .select("*, band:bands(name)")
    .order("erstellt_am", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((eintrag) => {
    const { band, ...rest } = eintrag as Sperreintrag & {
      band: { name: string } | null;
    };
    return { ...rest, bandName: band?.name ?? null };
  });
}

// Sperren zu einem Veranstalter - für den Hinweis auf seiner Seite. Liefert
// alle Bands, also auch die, bei denen NICHT gesperrt ist; die Anzeige
// unterscheidet dann zwischen "gesperrt" und "andere Band abgewiesen".
export async function holeSperrenFuerVenue(
  venueId: string
): Promise<SperrlisteEintragMitBand[]> {
  await requireFreigabe("akquise");

  const { data: venue } = await supabase
    .from("venues")
    .select("name, ort, email")
    .eq("id", venueId)
    .maybeSingle();
  if (!venue) return [];

  const treffer = await findeSperren({
    email: venue.email,
    name: venue.name,
    ort: venue.ort,
  });
  if (treffer.length === 0) return [];

  const { data: bands } = await supabase.from("bands").select("id, name");
  return treffer.map((eintrag) => ({
    ...eintrag,
    bandName: bands?.find((b) => b.id === eintrag.band_id)?.name ?? null,
  }));
}
