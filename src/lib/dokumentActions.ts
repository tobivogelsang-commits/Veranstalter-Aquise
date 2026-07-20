"use server";

import { revalidatePath } from "next/cache";
// service_role-Client (umgeht RLS). `supabase` und `supabaseAdmin` sind hier
// derselbe privilegierte Client; alle Funktionen sind Inhaber-Aktionen.
import { supabaseAdmin, supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { requireOwner } from "@/lib/authServer";

// Fügt der erweiterbaren Dokument-Liste einer Band einen neuen Typ hinzu
// (z. B. "Vertrag") - ab dann für jeden Veranstalter dieser Band als
// ankreuzbares Dokument verfügbar, wie Vorlagen/Mail-Zugangsdaten eine
// einzige, band-weite Quelle statt pro Veranstalter neu anzulegen.
// `revalidatePfad` statt einer festen venueId, da die Liste sowohl von einer
// Veranstalter-Seite als auch aus den Band-Einstellungen heraus gepflegt wird.
export async function fuegeDokumentTypHinzu(
  bandId: string,
  name: string,
  revalidatePfad: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireOwner();
  const bereinigt = name.trim();
  if (!bereinigt) return { ok: false, fehler: "Name fehlt." };

  const { error } = await supabase
    .from("band_dokument_typen")
    .insert({ band_id: bandId, name: bereinigt });

  if (error) return { ok: false, fehler: error.message };

  revalidatePath(revalidatePfad);
  return { ok: true };
}

export async function entferneDokumentTyp(
  dokumentTypId: string,
  revalidatePfad: string
) {
  await requireOwner();
  const { error } = await supabase
    .from("band_dokument_typen")
    .delete()
    .eq("id", dokumentTypId);
  if (error) throw new Error(error.message);

  revalidatePath(revalidatePfad);
}

// Schaltet um, ob ein Dokument als an diesen Veranstalter (für diese Band)
// verschickt markiert ist - setzt/löscht versendet_am statt nur ein
// Boolean, damit man auf einen Blick auch sieht, seit wann.
export async function toggleDokumentVersendet(
  venueId: string,
  bandId: string,
  dokumentTypId: string
) {
  await requireOwner();
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

// Lädt die Datei hinter einem Dokumententyp hoch (z. B. das Stage-Rider-PDF)
// - landet im selben öffentlichen Bucket wie Mail-Anhänge, damit sie sich
// später ohne erneuten Upload direkt als Anhang verwenden lässt.
export async function ladeDokumentDateiHoch(
  bandId: string,
  dokumentTypId: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireOwner();
  const datei = formData.get("datei");
  if (!(datei instanceof File)) {
    return { ok: false, fehler: "Keine Datei erhalten." };
  }
  if (datei.size === 0) {
    return { ok: false, fehler: "Datei ist leer." };
  }

  const sichererName = datei.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pfad = `${bandId}/dokumente/${dokumentTypId}-${Date.now()}-${sichererName}`;
  const buffer = Buffer.from(await datei.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("email-anhaenge")
    .upload(pfad, buffer, {
      contentType: datei.type || undefined,
      upsert: false,
    });
  if (uploadError) return { ok: false, fehler: uploadError.message };

  const { data } = supabaseAdmin.storage.from("email-anhaenge").getPublicUrl(pfad);

  const { error } = await supabase
    .from("band_dokument_typen")
    .update({ datei_url: data.publicUrl, dateiname: datei.name })
    .eq("id", dokumentTypId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/einstellungen/${bandId}`);
  return { ok: true };
}

export async function entferneDokumentDatei(dokumentTypId: string, bandId: string) {
  await requireOwner();
  const { error } = await supabase
    .from("band_dokument_typen")
    .update({ datei_url: null, dateiname: null })
    .eq("id", dokumentTypId);
  if (error) throw new Error(error.message);

  revalidatePath(`/einstellungen/${bandId}`);
}
