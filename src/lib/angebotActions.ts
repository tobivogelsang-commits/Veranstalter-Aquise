"use server";

// Angebote für Veranstalter. Reiner Inhaber-Bereich: alle Aktionen laufen
// hinter requireOwner() (anders als die Team-Aktionen, die über den geheimen
// Band-Link erreichbar sind).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin as supabase, supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOwner } from "@/lib/authServer";
import { ANHANG_BUCKET, anhangPfad } from "@/lib/storage";
import { getBandLogoUrl } from "@/lib/teamActions";
import { erzeugeAngebotPdf } from "@/lib/angebotPdf";
import type { AngebotPosition } from "@/lib/database.types";
import type { Angebot } from "@/lib/types";

const ERLAUBTE_UST = [0, 7, 19];

function revalidiereAngebote(angebotId?: string, venueId?: string | null) {
  revalidatePath("/angebote");
  if (angebotId) revalidatePath(`/angebote/${angebotId}`);
  if (venueId) revalidatePath(`/venues/${venueId}`);
}

// Fortlaufende Nummer im Format AG-<Jahr>-<lfd>, pro Band gezählt.
async function naechsteNummer(bandId: string): Promise<string> {
  const jahr = new Date().getFullYear();
  const praefix = `AG-${jahr}-`;

  const { data } = await supabase
    .from("angebote")
    .select("nummer")
    .eq("band_id", bandId)
    .like("nummer", `${praefix}%`)
    .order("nummer", { ascending: false })
    .limit(1);

  const letzte = data?.[0]?.nummer;
  const laufend = letzte ? Number(letzte.slice(praefix.length)) || 0 : 0;
  return `${praefix}${String(laufend + 1).padStart(3, "0")}`;
}

function bereinigePositionen(positionen: AngebotPosition[]): AngebotPosition[] {
  return positionen
    .map((p) => ({
      beschreibung: String(p.beschreibung ?? "").trim(),
      betrag: Number(p.betrag) || 0,
    }))
    // Komplett leere Zeilen verwerfen, damit sie nicht im PDF auftauchen.
    .filter((p) => p.beschreibung !== "" || p.betrag !== 0);
}

// Legt ein Angebot an - optional zu einem Veranstalter, dessen Anschrift dann
// als Kopie übernommen wird (spätere Änderungen am Veranstalter verändern das
// Angebot nicht mehr).
export async function erstelleAngebot(
  bandId: string,
  venueId: string | null
): Promise<{ ok: false; fehler: string } | never> {
  await requireOwner();

  const [{ data: band }, nummer] = await Promise.all([
    supabase.from("bands").select("ust_satz").eq("id", bandId).maybeSingle(),
    naechsteNummer(bandId),
  ]);

  let empfaenger = {
    empfaenger_name: "",
    empfaenger_ansprechpartner: null as string | null,
    empfaenger_strasse: null as string | null,
    empfaenger_plz: null as string | null,
    empfaenger_ort: null as string | null,
  };

  if (venueId) {
    const { data: venue } = await supabase
      .from("venues")
      .select("name, ansprechpartner, strasse, ort")
      .eq("id", venueId)
      .maybeSingle();
    if (venue) {
      empfaenger = {
        empfaenger_name: venue.name,
        empfaenger_ansprechpartner: venue.ansprechpartner,
        empfaenger_strasse: venue.strasse,
        empfaenger_plz: null,
        empfaenger_ort: venue.ort,
      };
    }
  }

  // Gültigkeit standardmäßig 30 Tage.
  const gueltigBis = new Date();
  gueltigBis.setDate(gueltigBis.getDate() + 30);

  const { data, error } = await supabase
    .from("angebote")
    .insert({
      band_id: bandId,
      venue_id: venueId,
      nummer,
      gueltig_bis: gueltigBis.toISOString().slice(0, 10),
      ust_satz: band?.ust_satz ?? 0,
      einleitung: "gerne unterbreiten wir Ihnen folgendes Angebot:",
      zahlungsbedingungen: "Zahlbar innerhalb von 14 Tagen nach Erhalt der Rechnung.",
      positionen: [],
      ...empfaenger,
    })
    .select("id")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidiereAngebote(undefined, venueId);
  redirect(`/angebote/${data.id}`);
}

export async function aktualisiereAngebot(
  angebotId: string,
  werte: {
    titel: string;
    datum: string;
    gueltigBis: string | null;
    venueId: string | null;
    empfaengerName: string;
    empfaengerAnsprechpartner: string | null;
    empfaengerStrasse: string | null;
    empfaengerPlz: string | null;
    empfaengerOrt: string | null;
    einleitung: string | null;
    positionen: AngebotPosition[];
    ustSatz: number;
    zahlungsbedingungen: string | null;
    nachbemerkung: string | null;
  }
): Promise<{ ok: true; angebot: Angebot } | { ok: false; fehler: string }> {
  await requireOwner();

  const ustSatz = ERLAUBTE_UST.includes(werte.ustSatz) ? werte.ustSatz : 0;

  const { data, error } = await supabase
    .from("angebote")
    .update({
      venue_id: werte.venueId,
      titel: werte.titel.trim() || "Angebot",
      datum: werte.datum,
      gueltig_bis: werte.gueltigBis,
      empfaenger_name: werte.empfaengerName.trim(),
      empfaenger_ansprechpartner: werte.empfaengerAnsprechpartner,
      empfaenger_strasse: werte.empfaengerStrasse,
      empfaenger_plz: werte.empfaengerPlz,
      empfaenger_ort: werte.empfaengerOrt,
      einleitung: werte.einleitung,
      positionen: bereinigePositionen(werte.positionen),
      ust_satz: ustSatz,
      zahlungsbedingungen: werte.zahlungsbedingungen,
      nachbemerkung: werte.nachbemerkung,
    })
    .eq("id", angebotId)
    .select("*")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidiereAngebote(angebotId, data.venue_id);
  return { ok: true, angebot: data };
}

export async function setzeAngebotStatus(
  angebotId: string,
  status: "entwurf" | "versendet" | "angenommen" | "abgelehnt"
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireOwner();
  const { error } = await supabase
    .from("angebote")
    .update({ status })
    .eq("id", angebotId);
  if (error) return { ok: false, fehler: error.message };

  revalidiereAngebote(angebotId);
  return { ok: true };
}

export async function loescheAngebot(
  angebotId: string
): Promise<{ ok: false; fehler: string } | never> {
  await requireOwner();

  const { data: angebot } = await supabase
    .from("angebote")
    .select("pdf_pfad")
    .eq("id", angebotId)
    .maybeSingle();

  const { error } = await supabase.from("angebote").delete().eq("id", angebotId);
  if (error) return { ok: false, fehler: error.message };

  if (angebot?.pdf_pfad) {
    await supabaseAdmin.storage.from(ANHANG_BUCKET).remove([angebot.pdf_pfad]);
  }

  revalidiereAngebote();
  redirect("/angebote");
}

// Erzeugt das PDF und legt es im privaten Anhang-Bucket ab - von dort lässt es
// sich später wie ein Dokument an die E-Mail hängen (Etappe 2). Ein bereits
// vorhandenes PDF wird ersetzt, damit nach jeder Änderung die aktuelle Fassung
// hängt.
export async function erzeugeAngebotPdfDatei(
  angebotId: string
): Promise<{ ok: true; pfad: string; dateiname: string } | { ok: false; fehler: string }> {
  await requireOwner();

  const { data: angebot, error } = await supabase
    .from("angebote")
    .select("*")
    .eq("id", angebotId)
    .maybeSingle();
  if (error) return { ok: false, fehler: error.message };
  if (!angebot) return { ok: false, fehler: "Angebot nicht gefunden." };

  const { data: band } = await supabase
    .from("bands")
    .select("*")
    .eq("id", angebot.band_id)
    .maybeSingle();
  if (!band) return { ok: false, fehler: "Band nicht gefunden." };

  const logoUrl = await getBandLogoUrl(band.id);

  let buffer: Buffer;
  try {
    buffer = await erzeugeAngebotPdf(angebot, band, logoUrl);
  } catch (err) {
    console.error("PDF-Erzeugung fehlgeschlagen", err);
    return {
      ok: false,
      fehler: err instanceof Error ? err.message : "PDF konnte nicht erzeugt werden.",
    };
  }

  const dateiname = `${angebot.titel.replace(/[^a-zA-Z0-9-_ ]/g, "")} ${angebot.nummer}.pdf`.trim();
  const pfad = anhangPfad(band.id, dateiname, "angebote");

  const { error: uploadFehler } = await supabaseAdmin.storage
    .from(ANHANG_BUCKET)
    .upload(pfad, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadFehler) return { ok: false, fehler: uploadFehler.message };

  // Vorgänger-Datei aufräumen, damit nicht bei jeder Änderung eine neue Leiche
  // im Speicher bleibt.
  if (angebot.pdf_pfad && angebot.pdf_pfad !== pfad) {
    await supabaseAdmin.storage.from(ANHANG_BUCKET).remove([angebot.pdf_pfad]);
  }

  await supabase
    .from("angebote")
    .update({ pdf_pfad: pfad, pdf_dateiname: dateiname })
    .eq("id", angebotId);

  revalidiereAngebote(angebotId, angebot.venue_id);
  return { ok: true, pfad, dateiname };
}
