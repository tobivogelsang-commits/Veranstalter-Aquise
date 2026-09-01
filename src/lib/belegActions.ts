"use server";

// Belege (Ausgaben) der Buchhaltung. Zwei Wege hinein:
//  - Desktop: Buchhaltungs-Freigabe noetig.
//  - Team-App: OHNE Desktop-Login (wie alle Team-Aktionen), abgesichert ueber
//    die Mitglieds-UUID + Band-Zugehoerigkeit - jedes Mitglied kann Belege
//    fotografieren und einreichen, sieht aber nur die eigenen.
// Belege werden nie geloescht (Aufbewahrungspflicht), nur korrigiert.
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireFreigabe } from "@/lib/authServer";
import { BELEG_BUCKET } from "@/lib/storage";
import type { Beleg } from "@/lib/types";
import type { BelegKategorie } from "@/lib/database.types";

const KATEGORIEN: BelegKategorie[] = [
  "fahrt",
  "technik",
  "proberaum",
  "merch_einkauf",
  "gema",
  "verpflegung",
  "sonstiges",
];

const MAX_DATEI_BYTES = 8 * 1024 * 1024;
const BILD_TYPEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ERLAUBTE_TYPEN = [...BILD_TYPEN, "application/pdf"];

function bereinigeKategorie(roh: unknown): BelegKategorie {
  return KATEGORIEN.includes(roh as BelegKategorie)
    ? (roh as BelegKategorie)
    : "sonstiges";
}

// "12,34" (deutsch) oder "12.34" -> Zahl mit 2 Nachkommastellen.
function parseBetrag(roh: unknown): number {
  const text = String(roh ?? "").trim().replace(/\./g, (m, i, s) =>
    // Punkt nur als Tausendertrenner entfernen, wenn auch ein Komma vorkommt.
    String(s).includes(",") ? "" : m
  );
  const zahl = Number(text.replace(",", "."));
  return Number.isFinite(zahl) ? Math.round(zahl * 100) / 100 : 0;
}

async function gehoertMitgliedZuBand(
  mitgliedId: string,
  bandId: string
): Promise<{ ok: boolean; name: string | null }> {
  const { data } = await supabaseAdmin
    .from("band_mitglieder")
    .select("name")
    .eq("id", mitgliedId)
    .eq("band_id", bandId)
    .maybeSingle();
  return { ok: Boolean(data), name: data?.name ?? null };
}

async function ladeDateiHoch(
  bandId: string,
  datei: File
): Promise<{ ok: true; pfad: string; typ: string } | { ok: false; fehler: string }> {
  if (!ERLAUBTE_TYPEN.includes(datei.type)) {
    return { ok: false, fehler: "Nur Fotos (JPG/PNG/WebP) oder PDF sind möglich." };
  }
  if (datei.size > MAX_DATEI_BYTES) {
    return { ok: false, fehler: "Die Datei ist zu groß (max. 8 MB)." };
  }
  const endung = datei.type === "application/pdf" ? "pdf" : (datei.type.split("/")[1] ?? "jpg");
  const pfad = `${bandId}/${randomUUID()}.${endung}`;
  const buffer = Buffer.from(await datei.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from(BELEG_BUCKET)
    .upload(pfad, buffer, { contentType: datei.type });
  if (error) return { ok: false, fehler: error.message };
  return { ok: true, pfad, typ: datei.type };
}

type BelegFelder = {
  datum: string;
  betrag: number;
  haendler: string | null;
  beschreibung: string | null;
  kategorie: BelegKategorie;
};

function felderAusFormData(formData: FormData): BelegFelder {
  const str = (key: string): string | null => {
    const wert = formData.get(key);
    return typeof wert === "string" && wert.trim() ? wert.trim() : null;
  };
  return {
    datum: str("datum") ?? new Date().toISOString().slice(0, 10),
    betrag: parseBetrag(formData.get("betrag")),
    haendler: str("haendler"),
    beschreibung: str("beschreibung"),
    kategorie: bereinigeKategorie(str("kategorie")),
  };
}

async function speichereBeleg(
  bandId: string,
  felder: BelegFelder,
  datei: File | null,
  mitglied: { id: string; name: string } | null
): Promise<{ ok: true; beleg: Beleg } | { ok: false; fehler: string }> {
  if (felder.betrag <= 0) return { ok: false, fehler: "Betrag fehlt." };

  let dateiPfad: string | null = null;
  let dateiTyp: string | null = null;
  if (datei && datei.size > 0) {
    const upload = await ladeDateiHoch(bandId, datei);
    if (!upload.ok) return upload;
    dateiPfad = upload.pfad;
    dateiTyp = upload.typ;
  }

  const { data, error } = await supabaseAdmin
    .from("belege")
    .insert({
      band_id: bandId,
      ...felder,
      mitglied_id: mitglied?.id ?? null,
      mitglied_name: mitglied?.name ?? null,
      datei_pfad: dateiPfad,
      datei_typ: dateiTyp,
    })
    .select("*")
    .single();
  if (error) return { ok: false, fehler: error.message };

  revalidatePath("/buchhaltung");
  return { ok: true, beleg: data };
}

// --- Desktop ------------------------------------------------------------------

export async function erstelleBeleg(
  bandId: string,
  formData: FormData
): Promise<{ ok: true; beleg: Beleg } | { ok: false; fehler: string }> {
  await requireFreigabe("buchhaltung_bearbeiten");

  // Optional: "bezahlt von" einem Mitglied (Auslage).
  const mitgliedId = formData.get("mitglied_id");
  let mitglied: { id: string; name: string } | null = null;
  if (typeof mitgliedId === "string" && mitgliedId) {
    const { data } = await supabaseAdmin
      .from("band_mitglieder")
      .select("id, name")
      .eq("id", mitgliedId)
      .eq("band_id", bandId)
      .maybeSingle();
    if (data) mitglied = data;
  }

  const datei = formData.get("datei");
  return speichereBeleg(
    bandId,
    felderAusFormData(formData),
    datei instanceof File ? datei : null,
    mitglied
  );
}

export async function aktualisiereBeleg(
  belegId: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireFreigabe("buchhaltung_bearbeiten");
  const felder = felderAusFormData(formData);
  if (felder.betrag <= 0) return { ok: false, fehler: "Betrag fehlt." };

  const { error } = await supabaseAdmin
    .from("belege")
    .update(felder)
    .eq("id", belegId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath("/buchhaltung");
  return { ok: true };
}

// Auslage als erstattet (oder wieder offen) markieren.
export async function setzeBelegErstattet(
  belegId: string,
  erstattet: boolean
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireFreigabe("buchhaltung_bearbeiten");
  const { error } = await supabaseAdmin
    .from("belege")
    .update({ erstattet_am: erstattet ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", belegId);
  if (error) return { ok: false, fehler: error.message };
  revalidatePath("/buchhaltung");
  return { ok: true };
}

// Kurzlebige Anzeige-URL fuer die Beleg-Datei (privater Bucket).
export async function getBelegDateiUrl(
  belegId: string
): Promise<{ ok: true; url: string } | { ok: false; fehler: string }> {
  await requireFreigabe("buchhaltung_ansehen");
  const { data: beleg } = await supabaseAdmin
    .from("belege")
    .select("datei_pfad")
    .eq("id", belegId)
    .maybeSingle();
  if (!beleg?.datei_pfad) return { ok: false, fehler: "Keine Datei hinterlegt." };
  const { data, error } = await supabaseAdmin.storage
    .from(BELEG_BUCKET)
    .createSignedUrl(beleg.datei_pfad, 60 * 10);
  if (error || !data) return { ok: false, fehler: error?.message ?? "Keine URL." };
  return { ok: true, url: data.signedUrl };
}

// --- KI: Foto auslesen --------------------------------------------------------

export type BelegVorschlag = {
  betrag: string | null;
  datum: string | null;
  haendler: string | null;
};

// Liest Betrag/Datum/Haendler aus einem Beleg-Foto (Vision). Bewusst nur ein
// VORSCHLAG - die Person prueft die Felder vor dem Speichern. Ohne API-Key
// oder bei Fehlern kommt einfach nichts zurueck, der Beleg geht trotzdem.
async function liesBelegAusBild(datei: File): Promise<BelegVorschlag | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!BILD_TYPEN.includes(datei.type) || datei.size > MAX_DATEI_BYTES) return null;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const base64 = Buffer.from(await datei.arrayBuffer()).toString("base64");

    const antwort = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "Du liest Kassenbons und Rechnungen aus. Antworte AUSSCHLIESSLICH mit " +
        "dem reinen JSON-Objekt, ohne Markdown-Codeblock, ohne Erklärung: " +
        '{"betrag": "Gesamtbetrag als Zahl mit Punkt, z. B. 12.34, oder null", ' +
        '"datum": "Belegdatum als YYYY-MM-DD oder null", ' +
        '"haendler": "Name des Geschäfts/Ausstellers oder null"}',
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: datei.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                data: base64,
              },
            },
            { type: "text", text: "Lies diesen Beleg aus." },
          ],
        },
      ],
    });

    const block = antwort.content[0];
    if (block.type !== "text") return null;
    const rohtext = block.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const json = JSON.parse(rohtext) as Record<string, unknown>;
    return {
      betrag: typeof json.betrag === "string" || typeof json.betrag === "number"
        ? String(json.betrag)
        : null,
      datum: typeof json.datum === "string" ? json.datum : null,
      haendler: typeof json.haendler === "string" ? json.haendler : null,
    };
  } catch {
    return null;
  }
}

export async function liesBelegBildAus(
  formData: FormData
): Promise<{ ok: true; vorschlag: BelegVorschlag | null } | { ok: false; fehler: string }> {
  await requireFreigabe("buchhaltung_bearbeiten");
  const datei = formData.get("datei");
  if (!(datei instanceof File)) return { ok: false, fehler: "Keine Datei." };
  return { ok: true, vorschlag: await liesBelegAusBild(datei) };
}

// --- Team-App -----------------------------------------------------------------

export async function erstelleBelegTeam(
  bandId: string,
  mitgliedId: string,
  formData: FormData
): Promise<{ ok: true; beleg: Beleg } | { ok: false; fehler: string }> {
  const mitglied = await gehoertMitgliedZuBand(mitgliedId, bandId);
  if (!mitglied.ok || !mitglied.name) {
    return { ok: false, fehler: "Mitglied nicht gefunden." };
  }
  const datei = formData.get("datei");
  return speichereBeleg(
    bandId,
    felderAusFormData(formData),
    datei instanceof File ? datei : null,
    { id: mitgliedId, name: mitglied.name }
  );
}

export async function liesBelegBildAusTeam(
  bandId: string,
  mitgliedId: string,
  formData: FormData
): Promise<{ ok: true; vorschlag: BelegVorschlag | null } | { ok: false; fehler: string }> {
  const mitglied = await gehoertMitgliedZuBand(mitgliedId, bandId);
  if (!mitglied.ok) return { ok: false, fehler: "Mitglied nicht gefunden." };
  const datei = formData.get("datei");
  if (!(datei instanceof File)) return { ok: false, fehler: "Keine Datei." };
  return { ok: true, vorschlag: await liesBelegAusBild(datei) };
}

// Eigene Belege eines Mitglieds fuer die Team-App-Ansicht.
export async function holeBelegeFuerMitglied(
  mitgliedId: string,
  bandId: string
): Promise<Beleg[]> {
  const mitglied = await gehoertMitgliedZuBand(mitgliedId, bandId);
  if (!mitglied.ok) return [];
  const { data } = await supabaseAdmin
    .from("belege")
    .select("*")
    .eq("band_id", bandId)
    .eq("mitglied_id", mitgliedId)
    .order("datum", { ascending: false })
    .limit(50);
  return data ?? [];
}
