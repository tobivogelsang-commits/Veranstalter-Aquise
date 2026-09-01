"use server";

// Rechnungen der Buchhaltung. Grundsaetze (GoBD, fuer eine Kleinunternehmer-
// GbR pragmatisch umgesetzt):
//  - Nummern RE-<Jahr>-<lfd> laufen pro Band lueckenlos fortlaufend.
//  - Ab Status "versendet" wird eine Rechnung nie mehr geaendert oder
//    geloescht - Korrektur nur ueber eine Storno-Rechnung (negative Betraege,
//    storno_von verweist auf das Original).
//  - Entwuerfe duerfen geloescht werden, aber nur der jeweils NEUESTE der
//    Band - so entsteht keine Luecke im Nummernkreis.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin as supabase, supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireFreigabe } from "@/lib/authServer";
import { ANHANG_BUCKET, anhangPfad } from "@/lib/storage";
import { getBandLogoUrl } from "@/lib/teamActions";
import { erzeugeRechnungPdf } from "@/lib/angebotPdf";
import type { AngebotPosition, RechnungStatus } from "@/lib/database.types";
import type { Rechnung } from "@/lib/types";

const ERLAUBTE_UST = [0, 7, 19];
const ZAHLUNGSZIEL_TAGE = 14;

function revalidiereBuchhaltung(rechnungId?: string, venueId?: string | null) {
  revalidatePath("/buchhaltung");
  if (rechnungId) revalidatePath(`/buchhaltung/rechnung/${rechnungId}`);
  if (venueId) revalidatePath(`/venues/${venueId}`);
}

// Fortlaufende Nummer im Format RE-<Jahr>-<lfd>, pro Band gezaehlt (gleiches
// Muster wie die Angebotsnummern).
async function naechsteNummer(bandId: string): Promise<string> {
  const jahr = new Date().getFullYear();
  const praefix = `RE-${jahr}-`;

  const { data } = await supabase
    .from("rechnungen")
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
      ...(p.optional ? { optional: true } : {}),
    }))
    .filter((p) => p.beschreibung !== "" || p.betrag !== 0);
}

function heuteIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function faelligkeitAb(datum: string): string {
  const d = new Date(datum);
  d.setDate(d.getDate() + ZAHLUNGSZIEL_TAGE);
  return d.toISOString().slice(0, 10);
}

// Wandelt ein Angebot in einen Rechnungs-Entwurf um: Empfaenger, Positionen
// und Konditionen werden KOPIERT (das Angebot bleibt unveraendert bestehen),
// das Leistungsdatum kommt vom Auftrittsdatum des Veranstalters. Das Angebot
// gilt damit als angenommen.
export async function erstelleRechnungAusAngebot(
  angebotId: string
): Promise<{ ok: false; fehler: string } | never> {
  await requireFreigabe("buchhaltung_bearbeiten");

  const { data: angebot } = await supabase
    .from("angebote")
    .select("*")
    .eq("id", angebotId)
    .maybeSingle();
  if (!angebot) return { ok: false, fehler: "Angebot nicht gefunden." };

  // Gibt es zu diesem Angebot schon eine (nicht stornierte) Rechnung, ist die
  // Umwandlung ein Versehen - besser dorthin leiten als doppelt abrechnen.
  const { data: vorhandene } = await supabase
    .from("rechnungen")
    .select("id")
    .eq("angebot_id", angebotId)
    .neq("status", "storniert")
    .limit(1);
  if (vorhandene?.length) {
    redirect(`/buchhaltung/rechnung/${vorhandene[0].id}`);
  }

  let leistungsdatum: string | null = null;
  if (angebot.venue_id) {
    const { data: venue } = await supabase
      .from("venues")
      .select("veranstaltungsdatum")
      .eq("id", angebot.venue_id)
      .maybeSingle();
    leistungsdatum = venue?.veranstaltungsdatum ?? null;
  }

  const datum = heuteIso();
  const { data, error } = await supabase
    .from("rechnungen")
    .insert({
      band_id: angebot.band_id,
      venue_id: angebot.venue_id,
      angebot_id: angebot.id,
      nummer: await naechsteNummer(angebot.band_id),
      datum,
      leistungsdatum,
      faellig_am: faelligkeitAb(datum),
      empfaenger_name: angebot.empfaenger_name,
      empfaenger_ansprechpartner: angebot.empfaenger_ansprechpartner,
      empfaenger_strasse: angebot.empfaenger_strasse,
      empfaenger_plz: angebot.empfaenger_plz,
      empfaenger_ort: angebot.empfaenger_ort,
      einleitung: `für unseren Auftritt stellen wir Ihnen vereinbarungsgemäß folgende Leistungen in Rechnung (Angebot ${angebot.nummer}):`,
      positionen: angebot.positionen,
      ust_satz: angebot.ust_satz,
      zahlungsbedingungen:
        angebot.zahlungsbedingungen ??
        `Zahlbar innerhalb von ${ZAHLUNGSZIEL_TAGE} Tagen ohne Abzug.`,
      nachbemerkung: angebot.nachbemerkung,
    })
    .select("id")
    .single();
  if (error) return { ok: false, fehler: error.message };

  // Wer eine Rechnung stellt, hat das Angebot gewonnen.
  await supabase
    .from("angebote")
    .update({ status: "angenommen" })
    .eq("id", angebotId)
    .neq("status", "angenommen");

  revalidatePath("/angebote");
  revalidatePath(`/angebote/${angebotId}`);
  revalidiereBuchhaltung(undefined, angebot.venue_id);
  redirect(`/buchhaltung/rechnung/${data.id}`);
}

// Freie Rechnung ohne Angebot (spontaner Gig, Merch-Bestellung, Quittung
// fuer Barzahlung).
export async function erstelleRechnung(
  bandId: string,
  venueId: string | null
): Promise<{ ok: false; fehler: string } | never> {
  await requireFreigabe("buchhaltung_bearbeiten");

  const { data: band } = await supabase
    .from("bands")
    .select("ust_satz")
    .eq("id", bandId)
    .maybeSingle();
  if (!band) return { ok: false, fehler: "Band nicht gefunden." };

  let empfaenger = {
    empfaenger_name: "",
    empfaenger_ansprechpartner: null as string | null,
    empfaenger_strasse: null as string | null,
    empfaenger_plz: null as string | null,
    empfaenger_ort: null as string | null,
  };
  let leistungsdatum: string | null = null;
  if (venueId) {
    const { data: venue } = await supabase
      .from("venues")
      .select("name, ansprechpartner, strasse, ort, veranstaltungsdatum")
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
      leistungsdatum = venue.veranstaltungsdatum;
    }
  }

  const datum = heuteIso();
  const { data, error } = await supabase
    .from("rechnungen")
    .insert({
      band_id: bandId,
      venue_id: venueId,
      nummer: await naechsteNummer(bandId),
      datum,
      leistungsdatum,
      faellig_am: faelligkeitAb(datum),
      einleitung: "wir erlauben uns, folgende Leistungen in Rechnung zu stellen:",
      zahlungsbedingungen: `Zahlbar innerhalb von ${ZAHLUNGSZIEL_TAGE} Tagen ohne Abzug.`,
      ust_satz: band.ust_satz ?? 0,
      positionen: [],
      ...empfaenger,
    })
    .select("id")
    .single();
  if (error) return { ok: false, fehler: error.message };

  revalidiereBuchhaltung(undefined, venueId);
  redirect(`/buchhaltung/rechnung/${data.id}`);
}

export async function aktualisiereRechnung(
  rechnungId: string,
  werte: {
    titel: string;
    datum: string;
    leistungsdatum: string | null;
    faelligAm: string | null;
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
): Promise<{ ok: true; rechnung: Rechnung } | { ok: false; fehler: string }> {
  await requireFreigabe("buchhaltung_bearbeiten");

  const { data: bestehend } = await supabase
    .from("rechnungen")
    .select("status")
    .eq("id", rechnungId)
    .maybeSingle();
  if (!bestehend) return { ok: false, fehler: "Rechnung nicht gefunden." };
  if (bestehend.status !== "entwurf") {
    return {
      ok: false,
      fehler:
        "Eine versendete Rechnung darf nicht mehr geändert werden. Bei Fehlern bitte stornieren und neu stellen.",
    };
  }

  const ustSatz = ERLAUBTE_UST.includes(werte.ustSatz) ? werte.ustSatz : 0;
  const { data, error } = await supabase
    .from("rechnungen")
    .update({
      venue_id: werte.venueId,
      titel: werte.titel.trim() || "Rechnung",
      datum: werte.datum,
      leistungsdatum: werte.leistungsdatum,
      faellig_am: werte.faelligAm,
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
    .eq("id", rechnungId)
    .select("*")
    .single();
  if (error) return { ok: false, fehler: error.message };

  revalidiereBuchhaltung(rechnungId, data.venue_id);
  return { ok: true, rechnung: data };
}

// Erlaubte Wege: entwurf -> versendet -> bezahlt (und bezahlt -> versendet,
// falls eine Zahlung versehentlich verbucht wurde). Zurueck auf "entwurf"
// gibt es nicht, und "storniert" nur ueber storniereRechnung.
export async function setzeRechnungStatus(
  rechnungId: string,
  status: Extract<RechnungStatus, "versendet" | "bezahlt">
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireFreigabe("buchhaltung_bearbeiten");

  const { data: rechnung } = await supabase
    .from("rechnungen")
    .select("status")
    .eq("id", rechnungId)
    .maybeSingle();
  if (!rechnung) return { ok: false, fehler: "Rechnung nicht gefunden." };
  if (rechnung.status === "storniert") {
    return { ok: false, fehler: "Eine stornierte Rechnung ändert sich nicht mehr." };
  }

  const { error } = await supabase
    .from("rechnungen")
    .update({
      status,
      bezahlt_am: status === "bezahlt" ? heuteIso() : null,
    })
    .eq("id", rechnungId);
  if (error) return { ok: false, fehler: error.message };

  revalidiereBuchhaltung(rechnungId);
  return { ok: true };
}

// Storno: Original wird als storniert markiert, eine neue Rechnung mit
// negierten Betraegen entsteht als Beleg der Korrektur.
export async function storniereRechnung(
  rechnungId: string
): Promise<{ ok: false; fehler: string } | never> {
  await requireFreigabe("buchhaltung_bearbeiten");

  const { data: original } = await supabase
    .from("rechnungen")
    .select("*")
    .eq("id", rechnungId)
    .maybeSingle();
  if (!original) return { ok: false, fehler: "Rechnung nicht gefunden." };
  if (original.status === "entwurf") {
    return { ok: false, fehler: "Ein Entwurf braucht kein Storno - einfach löschen." };
  }
  if (original.status === "storniert") {
    return { ok: false, fehler: "Diese Rechnung ist bereits storniert." };
  }

  const datum = heuteIso();
  const { data: storno, error } = await supabase
    .from("rechnungen")
    .insert({
      band_id: original.band_id,
      venue_id: original.venue_id,
      angebot_id: original.angebot_id,
      storno_von: original.id,
      nummer: await naechsteNummer(original.band_id),
      datum,
      leistungsdatum: original.leistungsdatum,
      titel: `Stornorechnung zu ${original.nummer}`,
      empfaenger_name: original.empfaenger_name,
      empfaenger_ansprechpartner: original.empfaenger_ansprechpartner,
      empfaenger_strasse: original.empfaenger_strasse,
      empfaenger_plz: original.empfaenger_plz,
      empfaenger_ort: original.empfaenger_ort,
      einleitung: `hiermit stornieren wir unsere Rechnung ${original.nummer} vom ${new Date(original.datum).toLocaleDateString("de-DE")} in voller Höhe:`,
      positionen: (original.positionen as AngebotPosition[]).map((p) => ({
        ...p,
        betrag: -p.betrag,
      })),
      ust_satz: original.ust_satz,
      status: "versendet",
    })
    .select("id")
    .single();
  if (error) return { ok: false, fehler: error.message };

  await supabase
    .from("rechnungen")
    .update({ status: "storniert" })
    .eq("id", original.id);

  revalidiereBuchhaltung(rechnungId, original.venue_id);
  redirect(`/buchhaltung/rechnung/${storno.id}`);
}

// Nur Entwuerfe, und nur der neueste der Band: So bleibt der Nummernkreis
// lueckenlos (die geloeschte Nummer wird als naechste einfach neu vergeben).
export async function loescheRechnung(
  rechnungId: string
): Promise<{ ok: false; fehler: string } | never> {
  await requireFreigabe("buchhaltung_bearbeiten");

  const { data: rechnung } = await supabase
    .from("rechnungen")
    .select("band_id, nummer, status, pdf_pfad")
    .eq("id", rechnungId)
    .maybeSingle();
  if (!rechnung) return { ok: false, fehler: "Rechnung nicht gefunden." };
  if (rechnung.status !== "entwurf") {
    return {
      ok: false,
      fehler: "Nur Entwürfe können gelöscht werden - versendete Rechnungen werden storniert.",
    };
  }

  const { data: neuere } = await supabase
    .from("rechnungen")
    .select("id")
    .eq("band_id", rechnung.band_id)
    .gt("nummer", rechnung.nummer)
    .limit(1);
  if (neuere?.length) {
    return {
      ok: false,
      fehler:
        "Es gibt schon eine neuere Rechnungsnummer - dieser Entwurf kann nicht mehr gelöscht werden (Lücke im Nummernkreis). Positionen leeren und wiederverwenden, oder stornieren nach dem Versand.",
    };
  }

  const { error } = await supabase.from("rechnungen").delete().eq("id", rechnungId);
  if (error) return { ok: false, fehler: error.message };

  if (rechnung.pdf_pfad) {
    await supabaseAdmin.storage.from(ANHANG_BUCKET).remove([rechnung.pdf_pfad]);
  }

  revalidiereBuchhaltung();
  redirect("/buchhaltung");
}

// PDF erzeugen und im privaten Anhang-Bucket ablegen (Muster wie beim
// Angebot; von dort haengt es an der Versand-Mail).
export async function erzeugeRechnungPdfDatei(
  rechnungId: string
): Promise<{ ok: true; pfad: string; dateiname: string } | { ok: false; fehler: string }> {
  await requireFreigabe("buchhaltung_ansehen");

  const { data: rechnung, error } = await supabase
    .from("rechnungen")
    .select("*")
    .eq("id", rechnungId)
    .maybeSingle();
  if (error) return { ok: false, fehler: error.message };
  if (!rechnung) return { ok: false, fehler: "Rechnung nicht gefunden." };

  const { data: band } = await supabase
    .from("bands")
    .select("*")
    .eq("id", rechnung.band_id)
    .maybeSingle();
  if (!band) return { ok: false, fehler: "Band nicht gefunden." };

  const logoUrl = await getBandLogoUrl(band.id);

  let buffer: Buffer;
  try {
    buffer = await erzeugeRechnungPdf(rechnung, band, logoUrl);
  } catch (err) {
    console.error("Rechnungs-PDF fehlgeschlagen", err);
    return {
      ok: false,
      fehler: err instanceof Error ? err.message : "PDF konnte nicht erzeugt werden.",
    };
  }

  const dateiname = `${rechnung.titel.replace(/[^a-zA-Z0-9-_ ]/g, "")} ${rechnung.nummer}.pdf`.trim();
  const pfad = anhangPfad(band.id, dateiname, "rechnungen");

  const { error: uploadFehler } = await supabaseAdmin.storage
    .from(ANHANG_BUCKET)
    .upload(pfad, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadFehler) return { ok: false, fehler: uploadFehler.message };

  if (rechnung.pdf_pfad && rechnung.pdf_pfad !== pfad) {
    await supabaseAdmin.storage.from(ANHANG_BUCKET).remove([rechnung.pdf_pfad]);
  }

  await supabase
    .from("rechnungen")
    .update({ pdf_pfad: pfad, pdf_dateiname: dateiname })
    .eq("id", rechnungId);

  revalidiereBuchhaltung(rechnungId, rechnung.venue_id);
  return { ok: true, pfad, dateiname };
}
