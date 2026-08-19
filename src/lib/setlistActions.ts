"use server";

import { revalidatePath } from "next/cache";
// service_role-Client (umgeht RLS). Diese Aktionen werden bewusst auch aus der
// öffentlichen Team-App (SetlisteBuilder) genutzt - daher KEIN requireOwner();
// Schutz ist die nicht erratbare Band-UUID, wie beim übrigen Team-Bereich.
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { sucheSongtext } from "@/lib/songtextSuche";
import type { SetlistPause } from "@/lib/database.types";
import type { BandSong, Setliste } from "@/lib/types";

// Jede Aktion filtert zusaetzlich nach band_id. Die bandId kam bisher nur fuer
// revalidatePath mit - ohne sie im WHERE genuegte die blosse Kenntnis einer
// fremden Song-/Setlisten-ID, um Daten einer anderen Band zu aendern oder zu
// loeschen. Ein Treffer null bedeutet: gibt es nicht ODER gehoert nicht zu
// dieser Band; beides beantworten wir gleich, damit die Antwort nicht verraet,
// ob eine fremde ID existiert.
const FREMD = "Nicht gefunden.";

// setlist_eintraege haengt nur an der Setliste und hat selbst keine band_id -
// die Zugehoerigkeit muss daher vorab ueber die Setliste geprueft werden.
async function gehoertSetlisteZuBand(setlistId: string, bandId: string) {
  const { data } = await supabase
    .from("setlisten")
    .select("id")
    .eq("id", setlistId)
    .eq("band_id", bandId)
    .maybeSingle();
  return Boolean(data);
}

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
    .eq("band_id", bandId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, fehler: error.message };
  if (!data) return { ok: false, fehler: FREMD };

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true, song: data };
}

// Loeschen ist absichtlich idempotent: trifft der band_id-Filter nichts (ID
// existiert nicht oder gehoert einer anderen Band), wird nichts geloescht und
// trotzdem Erfolg gemeldet. Das verraet einem Fremden nicht, ob eine ID
// existiert, und ein zweiter Klick / zweites Geraet laeuft nicht in einen
// Fehler.
export async function entferneSong(songId: string, bandId: string) {
  const { error } = await supabase
    .from("band_songs")
    .delete()
    .eq("id", songId)
    .eq("band_id", bandId);
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

  const { data, error } = await supabase
    .from("setlisten")
    .update({ name: bereinigt })
    .eq("id", setlistId)
    .eq("band_id", bandId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, fehler: error.message };
  if (!data) return { ok: false, fehler: FREMD };

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

  // Vorlage muss der eigenen Band gehoeren - sonst liessen sich fremde
  // Setlisten samt Songs in die eigene Band kopieren und damit auslesen.
  if (!(await gehoertSetlisteZuBand(setlistId, bandId))) {
    return { ok: false, fehler: FREMD };
  }

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

// Loeschen ist absichtlich idempotent: trifft der band_id-Filter nichts (ID
// existiert nicht oder gehoert einer anderen Band), wird nichts geloescht und
// trotzdem Erfolg gemeldet. Das verraet einem Fremden nicht, ob eine ID
// existiert, und ein zweiter Klick / zweites Geraet laeuft nicht in einen
// Fehler.
export async function loescheSetliste(setlistId: string, bandId: string) {
  const { error } = await supabase
    .from("setlisten")
    .delete()
    .eq("id", setlistId)
    .eq("band_id", bandId);
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

  const { data, error } = await supabase
    .from("setlisten")
    .update({ pausen: bereinigt })
    .eq("id", setlistId)
    .eq("band_id", bandId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, fehler: error.message };
  if (!data) return { ok: false, fehler: FREMD };

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
  if (!(await gehoertSetlisteZuBand(setlistId, bandId))) {
    return { ok: false, fehler: FREMD };
  }

  // Auch die Songs muessen der Band gehoeren, sonst liessen sich fremde Songs
  // in die eigene Setliste einhaengen und ihre Titel darueber auslesen.
  if (songIds.length > 0) {
    const { data: eigene } = await supabase
      .from("band_songs")
      .select("id")
      .eq("band_id", bandId)
      .in("id", songIds);
    const erlaubt = new Set((eigene ?? []).map((s) => s.id));
    if (songIds.some((id) => !erlaubt.has(id))) {
      return { ok: false, fehler: FREMD };
    }
  }

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

// Liefert den Songtext zum Mitlesen. Beim ersten Aufruf wird er bei lrclib.net
// gesucht und gespeichert; danach kommt er aus der Datenbank - auf einer Bühne
// soll nicht auf ein Netz gewartet werden, das dort erfahrungsgemäss schlecht
// ist.
//
// Ein erfolgloser Versuch wird ebenfalls vermerkt (songtext_geholt_am gesetzt,
// songtext null), damit nicht bei jedem Antippen erneut gesucht wird. Über
// `erneut` lässt sich das trotzdem anstossen - etwa nachdem der Titel
// korrigiert wurde.
export async function holeSongtext(
  songId: string,
  bandId: string,
  erneut = false
): Promise<
  | { ok: true; text: string | null; sync: string | null; hinweis: string | null }
  | { ok: false; fehler: string }
> {
  const { data: song } = await supabase
    .from("band_songs")
    .select(
      "id, titel, interpret, dauer_sekunden, songtext, songtext_sync, songtext_geholt_am"
    )
    .eq("id", songId)
    .eq("band_id", bandId)
    .maybeSingle();
  if (!song) return { ok: false, fehler: FREMD };

  if (!erneut && song.songtext) {
    return {
      ok: true,
      text: song.songtext,
      sync: song.songtext_sync,
      hinweis: null,
    };
  }
  if (!erneut && song.songtext_geholt_am && !song.songtext) {
    return {
      ok: true,
      text: null,
      sync: null,
      hinweis: "Für diesen Song wurde kein Text gefunden.",
    };
  }

  const ergebnis = await sucheSongtext(
    song.titel,
    song.interpret,
    song.dauer_sekunden
  );

  const gefunden = ergebnis.gefunden ? ergebnis.text : null;
  const gefundenSync = ergebnis.gefunden ? ergebnis.sync : null;
  // Auch bei einem Netzfehler den Zeitstempel setzen? Nein - sonst gilt ein
  // vorübergehend nicht erreichbarer Dienst dauerhaft als "kein Text".
  if (ergebnis.gefunden || ergebnis.grund !== "fehler") {
    await supabase
      .from("band_songs")
      .update({
        songtext: gefunden,
        songtext_sync: gefundenSync,
        songtext_geholt_am: new Date().toISOString(),
      })
      .eq("id", songId)
      .eq("band_id", bandId);
  }

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);

  if (ergebnis.gefunden) {
    return { ok: true, text: ergebnis.text, sync: ergebnis.sync, hinweis: null };
  }
  const hinweise = {
    instrumental: "Dieser Song ist als Instrumental hinterlegt – kein Text vorhanden.",
    kein_treffer: "Kein Text gefunden. Prüf mal Titel und Interpret am Song (✎).",
    fehler: "Textsuche gerade nicht erreichbar. Später nochmal versuchen.",
  };
  return { ok: true, text: null, sync: null, hinweis: hinweise[ergebnis.grund] };
}

// Von Hand geänderter Text (Cover werden gekürzt, Strophen getauscht). Leerer
// Text setzt zurück auf "noch nichts gesucht", damit die Suche erneut greift.
export async function speichereSongtext(
  songId: string,
  bandId: string,
  text: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const sauber = text.trim();
  const { data, error } = await supabase
    .from("band_songs")
    .update({
      songtext: sauber || null,
      // Von Hand geaenderter Text passt nicht mehr zu den Zeitmarken der
      // gefundenen Fassung - die synchrone Fassung wird daher verworfen.
      songtext_sync: null,
      songtext_geholt_am: sauber ? new Date().toISOString() : null,
    })
    .eq("id", songId)
    .eq("band_id", bandId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, fehler: error.message };
  if (!data) return { ok: false, fehler: FREMD };

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true };
}

// Timing des mitlaufenden Textes an die eigene Fassung anpassen.
//
// eigenerSync: eingelernte Zeiten (LRC) oder null, um wieder die Fassung von
// lrclib zu verwenden. versatzMs/tempo wirken zusätzlich auf die jeweils
// gültige Fassung. Alle drei zusammen in einer Aktion, weil sie in der
// Bühnenansicht auch gemeinsam gesichert werden.
export async function speichereSongtextTiming(
  songId: string,
  bandId: string,
  werte: { eigenerSync?: string | null; versatzMs: number; tempo: number }
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  // Grenzen wie in der Datenbank (CHECK) - hier abfangen, damit statt eines
  // rohen Constraint-Fehlers eine verständliche Meldung ankommt.
  const tempo = Math.min(200, Math.max(50, Math.round(werte.tempo)));
  const versatz = Math.round(werte.versatzMs);

  // songtext_sync_eigen nur anfassen, wenn ausdrücklich mitgegeben - sonst
  // wuerde ein blosses Verstellen der Regler eingelernte Zeiten loeschen.
  const aenderung = {
    songtext_versatz_ms: versatz,
    songtext_tempo: tempo,
    ...("eigenerSync" in werte
      ? { songtext_sync_eigen: werte.eigenerSync?.trim() || null }
      : {}),
  };

  const { data, error } = await supabase
    .from("band_songs")
    .update(aenderung)
    .eq("id", songId)
    .eq("band_id", bandId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, fehler: error.message };
  if (!data) return { ok: false, fehler: FREMD };

  revalidatePath(`/setliste/${bandId}`);
  revalidatePath(`/team/${bandId}`);
  return { ok: true };
}
