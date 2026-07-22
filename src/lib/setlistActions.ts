"use server";

import { revalidatePath } from "next/cache";
// service_role-Client (umgeht RLS). Diese Aktionen werden bewusst auch aus der
// öffentlichen Team-App (SetlisteBuilder) genutzt - daher KEIN requireOwner();
// Schutz ist die nicht erratbare Band-UUID, wie beim übrigen Team-Bereich.
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { SetlistPause } from "@/lib/database.types";
import type { BandSong, Setliste } from "@/lib/types";

export async function fuegeSongHinzu(
  bandId: string,
  titel: string,
  interpret: string | null,
  dauerSekunden: number | null
): Promise<{ ok: true; song: BandSong } | { ok: false; fehler: string }> {
  const bereinigt = titel.trim();
  if (!bereinigt) return { ok: false, fehler: "Titel fehlt." };

  const { data, error } = await supabase
    .from("band_songs")
    .insert({
      band_id: bandId,
      titel: bereinigt,
      interpret: interpret?.trim() || null,
      dauer_sekunden: dauerSekunden,
    })
    .select("*")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true, song: data };
}

// Nachträgliches Bearbeiten eines Katalog-Songs (Titel/Interpret/Dauer).
// Wirkt überall, wo der Song referenziert wird (Setlisten, Laufzeiten,
// Druckansicht), da diese nur auf band_songs verweisen.
export async function bearbeiteSong(
  songId: string,
  bandId: string,
  titel: string,
  interpret: string | null,
  dauerSekunden: number | null
): Promise<{ ok: true; song: BandSong } | { ok: false; fehler: string }> {
  const bereinigt = titel.trim();
  if (!bereinigt) return { ok: false, fehler: "Titel fehlt." };

  const { data, error } = await supabase
    .from("band_songs")
    .update({
      titel: bereinigt,
      interpret: interpret?.trim() || null,
      dauer_sekunden: dauerSekunden,
    })
    .eq("id", songId)
    .select("*")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true, song: data };
}

export async function entferneSong(songId: string, bandId: string) {
  const { error } = await supabase.from("band_songs").delete().eq("id", songId);
  if (error) throw new Error(error.message);

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
}

export async function erstelleSetliste(
  bandId: string,
  name: string
): Promise<{ ok: true; setliste: Setliste } | { ok: false; fehler: string }> {
  const bereinigt = name.trim();
  if (!bereinigt) return { ok: false, fehler: "Name fehlt." };

  const { data, error } = await supabase
    .from("setlisten")
    .insert({ band_id: bandId, name: bereinigt })
    .select("*")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true, setliste: data };
}

export async function benenneSetlisteUm(
  setlistId: string,
  bandId: string,
  name: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const bereinigt = name.trim();
  if (!bereinigt) return { ok: false, fehler: "Name fehlt." };

  const { error } = await supabase
    .from("setlisten")
    .update({ name: bereinigt })
    .eq("id", setlistId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true };
}

export async function dupliziereSetliste(
  setlistId: string,
  bandId: string,
  neuerName: string
): Promise<{ ok: true; setliste: Setliste } | { ok: false; fehler: string }> {
  const bereinigt = neuerName.trim();
  if (!bereinigt) return { ok: false, fehler: "Name fehlt." };

  const { data: neueSetliste, error: erstellFehler } = await supabase
    .from("setlisten")
    .insert({ band_id: bandId, name: bereinigt })
    .select("*")
    .single();
  if (erstellFehler) return { ok: false, fehler: erstellFehler.message };

  const { data: bestehende, error: leseFehler } = await supabase
    .from("setlist_eintraege")
    .select("song_id, position")
    .eq("setlist_id", setlistId)
    .order("position");
  if (leseFehler) return { ok: false, fehler: leseFehler.message };

  if (bestehende && bestehende.length > 0) {
    const { error: kopierFehler } = await supabase.from("setlist_eintraege").insert(
      bestehende.map((eintrag) => ({
        setlist_id: neueSetliste.id,
        song_id: eintrag.song_id,
        position: eintrag.position,
      }))
    );
    if (kopierFehler) return { ok: false, fehler: kopierFehler.message };
  }

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true, setliste: neueSetliste };
}

export async function loescheSetliste(setlistId: string, bandId: string) {
  const { error } = await supabase.from("setlisten").delete().eq("id", setlistId);
  if (error) throw new Error(error.message);

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
}

// Speichert die Pausen einer Setliste (ersetzt die komplette Liste). Bereinigt
// ungültige Einträge, damit die Berechnung der Set-Zeiten robust bleibt.
export async function speicherePausen(
  setlistId: string,
  bandId: string,
  pausen: SetlistPause[]
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const bereinigt = (Array.isArray(pausen) ? pausen : [])
    .map((p) => ({
      nach_index: Math.trunc(Number(p?.nach_index)),
      minuten: Math.trunc(Number(p?.minuten)),
    }))
    .filter((p) => Number.isFinite(p.nach_index) && p.nach_index >= 0 && p.minuten > 0);

  const { error } = await supabase
    .from("setlisten")
    .update({ pausen: bereinigt })
    .eq("id", setlistId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true };
}

// Ersetzt die komplette Song-Reihenfolge einer Setliste - einfacher als
// einzelne Positions-Verschiebungen beim Umsortieren/Hinzufügen/Entfernen zu
// berechnen, bei den zu erwartenden Setlisten-Größen unbedenklich.
export async function speichereSetlistReihenfolge(
  setlistId: string,
  bandId: string,
  songIds: string[]
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { error: loeschFehler } = await supabase
    .from("setlist_eintraege")
    .delete()
    .eq("setlist_id", setlistId);
  if (loeschFehler) return { ok: false, fehler: loeschFehler.message };

  if (songIds.length > 0) {
    const { error: einfuegeFehler } = await supabase.from("setlist_eintraege").insert(
      songIds.map((songId, index) => ({
        setlist_id: setlistId,
        song_id: songId,
        position: index,
      }))
    );
    if (einfuegeFehler) return { ok: false, fehler: einfuegeFehler.message };
  }

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true };
}
