"use server";

// Urlaube der Band-Mitglieder. service_role-Client (umgeht RLS). BEWUSST OHNE
// requireOwner(): Mitglieder tragen ihren Urlaub selbst in der öffentlichen
// Team-App ein; Schutz ist wie überall die nicht erratbare Band-UUID. Am
// Desktop sitzt zusätzlich der Login-Proxy davor.
import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { UrlaubMitName } from "@/lib/types";

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

function revalidiereKalender(bandId: string) {
  revalidatePath("/kalender");
  revalidatePath(`/team/${bandId}`);
}

export async function erstelleUrlaub(
  mitgliedId: string,
  bandId: string,
  von: string,
  bis: string
): Promise<{ ok: true; urlaub: UrlaubMitName } | { ok: false; fehler: string }> {
  if (!ISO_DATUM.test(von) || !ISO_DATUM.test(bis)) {
    return { ok: false, fehler: "Bitte beide Daten angeben." };
  }
  if (bis < von) return { ok: false, fehler: "Ende liegt vor dem Beginn." };

  // Mitglied muss zur angegebenen Band gehören (Aktion ist öffentlich
  // erreichbar; verhindert Einträge für fremde Mitglieder über eine andere
  // Band-URL).
  const { data: mitglied, error: mitgliedFehler } = await supabase
    .from("band_mitglieder")
    .select("id, name, band_id")
    .eq("id", mitgliedId)
    .eq("band_id", bandId)
    .maybeSingle();
  if (mitgliedFehler) return { ok: false, fehler: mitgliedFehler.message };
  if (!mitglied) return { ok: false, fehler: "Mitglied nicht gefunden." };

  const { data, error } = await supabase
    .from("mitglied_urlaube")
    .insert({ mitglied_id: mitgliedId, von, bis })
    .select("id, von, bis")
    .single();
  if (error) return { ok: false, fehler: error.message };

  revalidiereKalender(bandId);
  return {
    ok: true,
    urlaub: {
      id: data.id,
      mitgliedId: mitglied.id,
      bandId: mitglied.band_id,
      name: mitglied.name,
      von: data.von,
      bis: data.bis,
    },
  };
}

export async function loescheUrlaub(
  urlaubId: string,
  bandId: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { error } = await supabase.from("mitglied_urlaube").delete().eq("id", urlaubId);
  if (error) return { ok: false, fehler: error.message };

  revalidiereKalender(bandId);
  return { ok: true };
}
