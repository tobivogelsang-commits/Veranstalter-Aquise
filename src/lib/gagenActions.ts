"use server";

// Gagenverteilung: Anteile einer Rechnung je Mitglied. Vorbelegung macht die
// Oberflaeche (Gesamtbetrag gleichmaessig auf alle, anpassbar/abwaehlbar) -
// hier wird nur gespeichert und als ausgezahlt markiert.
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireFreigabe } from "@/lib/authServer";
import type { GagenAnteil } from "@/lib/types";

export async function speichereGagenverteilung(
  rechnungId: string,
  anteile: { mitgliedId: string | null; name: string; betrag: number }[]
): Promise<{ ok: true; anteile: GagenAnteil[] } | { ok: false; fehler: string }> {
  await requireFreigabe("buchhaltung_bearbeiten");

  const { data: rechnung } = await supabaseAdmin
    .from("rechnungen")
    .select("band_id")
    .eq("id", rechnungId)
    .maybeSingle();
  if (!rechnung) return { ok: false, fehler: "Rechnung nicht gefunden." };

  const bereinigt = anteile
    .map((a) => ({
      mitglied_id: a.mitgliedId,
      mitglied_name: a.name.trim(),
      betrag: Math.round((Number(a.betrag) || 0) * 100) / 100,
    }))
    .filter((a) => a.mitglied_name && a.betrag !== 0);

  // Bereits als ausgezahlt markierte Anteile bleiben unangetastet - neu
  // gespeichert wird nur der noch offene Teil der Verteilung.
  const { data: ausgezahlte } = await supabaseAdmin
    .from("gagen_anteile")
    .select("mitglied_name")
    .eq("rechnung_id", rechnungId)
    .not("ausgezahlt_am", "is", null);
  const gesperrteNamen = new Set((ausgezahlte ?? []).map((a) => a.mitglied_name));

  await supabaseAdmin
    .from("gagen_anteile")
    .delete()
    .eq("rechnung_id", rechnungId)
    .is("ausgezahlt_am", null);

  const neue = bereinigt.filter((a) => !gesperrteNamen.has(a.mitglied_name));
  if (neue.length > 0) {
    const { error } = await supabaseAdmin.from("gagen_anteile").insert(
      neue.map((a) => ({ ...a, band_id: rechnung.band_id, rechnung_id: rechnungId }))
    );
    if (error) return { ok: false, fehler: error.message };
  }

  const { data } = await supabaseAdmin
    .from("gagen_anteile")
    .select("*")
    .eq("rechnung_id", rechnungId)
    .order("mitglied_name");

  revalidatePath("/buchhaltung");
  revalidatePath(`/buchhaltung/rechnung/${rechnungId}`);
  return { ok: true, anteile: data ?? [] };
}

export async function setzeAnteilAusgezahlt(
  anteilId: string,
  ausgezahlt: boolean
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireFreigabe("buchhaltung_bearbeiten");
  const { error } = await supabaseAdmin
    .from("gagen_anteile")
    .update({
      ausgezahlt_am: ausgezahlt ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", anteilId);
  if (error) return { ok: false, fehler: error.message };
  revalidatePath("/buchhaltung");
  return { ok: true };
}
