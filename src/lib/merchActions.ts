"use server";

// Merch-Lager (Bestand + Design-/Druckvorlagen).
// service_role-Client (umgeht RLS). BEWUSST OHNE requireOwner() bei den
// Bestands-Aktionen: Bandmitglieder buchen in der Team-App nach einem Gig ab,
// was verkauft wurde - gesichert über den geheimen Band-Link wie die übrigen
// Team-Aktionen. Das Anlegen/Ändern von Artikeln und die Vorlagen-Verwaltung
// bleiben dem Inhaber vorbehalten (requireOwner), sie passieren nur am Desktop.
import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase, supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOwner } from "@/lib/authServer";
import { ANHANG_BUCKET, anhangPfad } from "@/lib/storage";
import type { MerchArtikel } from "@/lib/types";

function revalidiereMerch(bandId: string) {
  revalidatePath("/merch");
  revalidatePath(`/team/${bandId}`);
  revalidatePath("/");
}

export async function erstelleMerchArtikel(
  bandId: string,
  werte: {
    kategorie: string;
    name: string;
    variante: string;
    bestand: number;
    mindestbestand: number;
  }
): Promise<{ ok: true; artikel: MerchArtikel } | { ok: false; fehler: string }> {
  await requireOwner();
  const name = werte.name.trim();
  if (!name) return { ok: false, fehler: "Name fehlt." };

  const { data, error } = await supabase
    .from("merch_artikel")
    .insert({
      band_id: bandId,
      kategorie: werte.kategorie.trim() || "Sonstiges",
      name,
      variante: werte.variante.trim(),
      bestand: Math.max(0, Math.trunc(werte.bestand)),
      mindestbestand: Math.max(0, Math.trunc(werte.mindestbestand)),
    })
    .select("*")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidiereMerch(bandId);
  return { ok: true, artikel: data };
}

export async function aktualisiereMerchArtikel(
  artikelId: string,
  bandId: string,
  werte: {
    kategorie: string;
    name: string;
    variante: string;
    mindestbestand: number;
  }
): Promise<{ ok: true; artikel: MerchArtikel } | { ok: false; fehler: string }> {
  await requireOwner();
  const name = werte.name.trim();
  if (!name) return { ok: false, fehler: "Name fehlt." };

  const { data, error } = await supabase
    .from("merch_artikel")
    .update({
      kategorie: werte.kategorie.trim() || "Sonstiges",
      name,
      variante: werte.variante.trim(),
      mindestbestand: Math.max(0, Math.trunc(werte.mindestbestand)),
    })
    .eq("id", artikelId)
    .select("*")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidiereMerch(bandId);
  return { ok: true, artikel: data };
}

// Setzt den Bestand auf einen absoluten Wert. Bewusst ohne requireOwner:
// auch aus der Team-App nutzbar (−/+ nach einem Gig). Negative Werte werden
// auf 0 geklemmt, damit der DB-Check nicht greift.
export async function setzeMerchBestand(
  artikelId: string,
  bandId: string,
  bestand: number
): Promise<{ ok: true; bestand: number } | { ok: false; fehler: string }> {
  const sicher = Math.max(0, Math.trunc(bestand));
  const { data, error } = await supabase
    .from("merch_artikel")
    .update({ bestand: sicher })
    .eq("id", artikelId)
    .eq("band_id", bandId)
    .select("bestand")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidiereMerch(bandId);
  return { ok: true, bestand: data.bestand };
}

export async function loescheMerchArtikel(
  artikelId: string,
  bandId: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireOwner();
  const { error } = await supabase.from("merch_artikel").delete().eq("id", artikelId);
  if (error) return { ok: false, fehler: error.message };

  revalidiereMerch(bandId);
  return { ok: true };
}

// Bilder bekommen in der Übersicht eine Vorschau, alles andere (PDF, AI, ZIP)
// nur einen Download-Link.
function istBilddatei(typ: string, dateiname: string): boolean {
  if (typ.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(dateiname);
}

export async function ladeMerchVorlageHoch(
  bandId: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireOwner();
  const datei = formData.get("datei");
  if (!(datei instanceof File)) return { ok: false, fehler: "Keine Datei erhalten." };
  if (datei.size === 0) return { ok: false, fehler: "Datei ist leer." };

  const titel = String(formData.get("titel") ?? "").trim();
  const artikelIdRoh = String(formData.get("artikelId") ?? "").trim();
  const artikelId = artikelIdRoh || null;

  const pfad = anhangPfad(bandId, datei.name, "merch");
  const buffer = Buffer.from(await datei.arrayBuffer());

  const { error: uploadFehler } = await supabaseAdmin.storage
    .from(ANHANG_BUCKET)
    .upload(pfad, buffer, { contentType: datei.type || undefined, upsert: false });
  if (uploadFehler) return { ok: false, fehler: uploadFehler.message };

  const { error } = await supabase.from("merch_vorlagen").insert({
    band_id: bandId,
    artikel_id: artikelId,
    titel: titel || datei.name,
    dateiname: datei.name,
    pfad,
    ist_bild: istBilddatei(datei.type, datei.name),
  });
  if (error) return { ok: false, fehler: error.message };

  revalidiereMerch(bandId);
  return { ok: true };
}

export async function loescheMerchVorlage(
  vorlageId: string,
  bandId: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireOwner();

  const { data: vorlage } = await supabase
    .from("merch_vorlagen")
    .select("pfad")
    .eq("id", vorlageId)
    .maybeSingle();

  const { error } = await supabase.from("merch_vorlagen").delete().eq("id", vorlageId);
  if (error) return { ok: false, fehler: error.message };

  // Datei im Storage aufräumen (best effort - ein verwaister Blob ist
  // harmloser als ein fehlgeschlagenes Löschen in der App).
  if (vorlage?.pfad) {
    await supabaseAdmin.storage.from(ANHANG_BUCKET).remove([vorlage.pfad]);
  }

  revalidiereMerch(bandId);
  return { ok: true };
}
