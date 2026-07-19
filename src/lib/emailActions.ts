"use server";

import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rueckeStatusAutomatischVor } from "@/lib/actions";
import type { EmailAnhang } from "@/lib/database.types";
import type { EmailEinstellungenOhnePasswort } from "@/lib/types";

// 2-Wochen-Timer fürs Nachfassen, gestartet beim ersten Kontakt per E-Mail.
function inZweiWochen(): string {
  const datum = new Date();
  datum.setDate(datum.getDate() + 14);
  return datum.toISOString();
}

// Einfache Stichwort-Heuristik statt NLP: Nur bei eindeutigen
// Absage-Formulierungen wird als "abgesagt" gewertet, alles andere als
// grundsätzliches Interesse ("interessiert") - im Zweifel lieber in der
// Pipeline sichtbar bleiben, der Nutzer liest die E-Mail ohnehin mit.
const ABSAGE_MUSTER = [
  "kein interesse",
  "keine interesse",
  "leider nein",
  "leider nicht möglich",
  "nicht möglich",
  "nicht buchbar",
  "keine kapazität",
  "keine kapazitäten",
  "ausgebucht",
  "müssen absagen",
  "müssen leider absagen",
  "sagen leider ab",
  "passt leider nicht",
  "kommt nicht in frage",
];

function klassifiziereAntwort(text: string): "interessiert" | "abgesagt" {
  const t = text.toLowerCase();
  return ABSAGE_MUSTER.some((muster) => t.includes(muster))
    ? "abgesagt"
    : "interessiert";
}

// Versucht, eine E-Mail-Adresse einem bestehenden Veranstalter zuzuordnen
// (Groß-/Kleinschreibung wird ignoriert). Genutzt für automatisches Zuordnen
// beim Senden (An-Adresse) und Empfangen (Von-Adresse).
async function findeVenueIdFuerAdresse(adresse: string): Promise<string | null> {
  const bereinigt = adresse.trim();
  if (!bereinigt) return null;

  const { data } = await supabase
    .from("venues")
    .select("id")
    .ilike("email", bereinigt)
    .maybeSingle();

  return data?.id ?? null;
}

function leereEinstellungen(bandId: string): EmailEinstellungenOhnePasswort {
  return {
    id: "",
    band_id: bandId,
    absender_name: null,
    email_adresse: null,
    smtp_host: null,
    smtp_port: null,
    smtp_ssl: true,
    imap_host: null,
    imap_port: null,
    imap_ssl: true,
    aktualisiert_am: new Date().toISOString(),
    passwortGesetzt: false,
  };
}

// Liefert die Einstellungen OHNE Passwort - das geht nie an den Client
// zurück, nur ob eins gesetzt ist. Läuft über den service_role-Client, da
// die Tabelle bewusst keine RLS-Policy für anon/authenticated hat.
export async function getEmailEinstellungen(
  bandId: string
): Promise<EmailEinstellungenOhnePasswort> {
  const { data, error } = await supabaseAdmin
    .from("band_email_konten")
    .select("*")
    .eq("band_id", bandId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return leereEinstellungen(bandId);

  const { passwort, ...rest } = data;
  return { ...rest, passwortGesetzt: Boolean(passwort) };
}

export async function speichereEmailEinstellungen(
  bandId: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  function str(key: string): string | null {
    const value = formData.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  function num(key: string): number | null {
    const value = str(key);
    return value ? Number(value) : null;
  }

  const { data: bestehend } = await supabaseAdmin
    .from("band_email_konten")
    .select("passwort")
    .eq("band_id", bandId)
    .maybeSingle();

  // Leeres Passwortfeld beim Bearbeiten = bestehendes Passwort behalten
  // (wir zeigen das echte Passwort nie in der UI an).
  const neuesPasswort = str("passwort") ?? bestehend?.passwort ?? null;

  const { error } = await supabaseAdmin.from("band_email_konten").upsert(
    {
      band_id: bandId,
      absender_name: str("absender_name"),
      email_adresse: str("email_adresse"),
      passwort: neuesPasswort,
      smtp_host: str("smtp_host"),
      smtp_port: num("smtp_port"),
      smtp_ssl: formData.get("smtp_ssl") === "on",
      imap_host: str("imap_host"),
      imap_port: num("imap_port"),
      imap_ssl: formData.get("imap_ssl") === "on",
      aktualisiert_am: new Date().toISOString(),
    },
    { onConflict: "band_id" }
  );

  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/einstellungen/${bandId}`);
  return { ok: true };
}

export async function speichereEmailVorlage(
  bandId: string,
  vorlageId: string | null,
  formData: FormData
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const name = (String(formData.get("name") ?? "")).trim();
  const betreff = (String(formData.get("betreff") ?? "")).trim();
  const inhalt = String(formData.get("inhalt") ?? "");

  if (!name) return { ok: false, fehler: "Name fehlt." };

  const { error } = vorlageId
    ? await supabaseAdmin
        .from("email_vorlagen")
        .update({ name, betreff, inhalt })
        .eq("id", vorlageId)
    : await supabaseAdmin
        .from("email_vorlagen")
        .insert({ band_id: bandId, name, betreff, inhalt });

  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/einstellungen/${bandId}`);
  return { ok: true };
}

export async function loescheEmailVorlage(bandId: string, vorlageId: string) {
  const { error } = await supabaseAdmin
    .from("email_vorlagen")
    .delete()
    .eq("id", vorlageId);
  if (error) throw new Error(error.message);

  revalidatePath(`/einstellungen/${bandId}`);
}

// Lädt eine Datei (Bild fürs Einfügen in den Mailtext, oder ein Anhang wie ein
// Angebot-PDF) ins öffentliche Storage-Bucket "email-anhaenge" hoch. Die
// öffentliche URL ist direkt als <img src> in der HTML-Mail sowie als
// nodemailer-Attachment-Pfad nutzbar (kein Signieren/erneutes Abrufen nötig).
export async function ladeEmailAnhangHoch(
  bandId: string,
  formData: FormData
): Promise<
  { ok: true; dateiname: string; url: string } | { ok: false; fehler: string }
> {
  const datei = formData.get("datei");
  if (!(datei instanceof File)) {
    return { ok: false, fehler: "Keine Datei erhalten." };
  }
  if (datei.size === 0) {
    return { ok: false, fehler: "Datei ist leer." };
  }

  const sichererName = datei.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pfad = `${bandId}/${Date.now()}-${sichererName}`;
  const buffer = Buffer.from(await datei.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from("email-anhaenge")
    .upload(pfad, buffer, {
      contentType: datei.type || undefined,
      upsert: false,
    });

  if (error) return { ok: false, fehler: error.message };

  const { data } = supabaseAdmin.storage.from("email-anhaenge").getPublicUrl(pfad);

  return { ok: true, dateiname: datei.name, url: data.publicUrl };
}

export async function sendeEmail(
  bandId: string,
  an: string,
  betreff: string,
  html: string,
  venueId?: string | null,
  anhaenge?: EmailAnhang[]
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  if (!an.trim()) return { ok: false, fehler: "Empfänger fehlt." };

  const { data: konto, error } = await supabaseAdmin
    .from("band_email_konten")
    .select("*")
    .eq("band_id", bandId)
    .maybeSingle();

  if (error) return { ok: false, fehler: error.message };
  if (!konto?.email_adresse || !konto.passwort || !konto.smtp_host) {
    return {
      ok: false,
      fehler: "E-Mail-Einstellungen sind unvollständig (siehe Einstellungen).",
    };
  }

  const transporter = nodemailer.createTransport({
    host: konto.smtp_host,
    port: konto.smtp_port ?? 587,
    secure: konto.smtp_ssl,
    auth: { user: konto.email_adresse, pass: konto.passwort },
    connectionTimeout: 10000,
  });

  // Einfacher Text-Fallback fürs "text"-Alternativteil der Mail (für Mail-
  // Programme/Vorschauen ohne HTML-Darstellung) - reines Tag-Strippen reicht,
  // eine exakte Formatierung ist dafür nicht nötig.
  const textFallback = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  try {
    await transporter.sendMail({
      from: konto.absender_name
        ? `"${konto.absender_name}" <${konto.email_adresse}>`
        : konto.email_adresse,
      to: an,
      subject: betreff,
      html,
      text: textFallback,
      attachments: (anhaenge ?? []).map((a) => ({
        filename: a.dateiname,
        path: a.url,
      })),
    });
  } catch (err) {
    return {
      ok: false,
      fehler:
        err instanceof Error
          ? `Versand fehlgeschlagen: ${err.message}`
          : "Versand fehlgeschlagen.",
    };
  }

  const zugeordneteVenueId = venueId ?? (await findeVenueIdFuerAdresse(an));

  const { error: insertError } = await supabase.from("band_emails").insert({
    band_id: bandId,
    venue_id: zugeordneteVenueId,
    richtung: "gesendet",
    von: konto.email_adresse,
    an,
    betreff,
    text_inhalt: html,
    anhaenge: anhaenge && anhaenge.length > 0 ? anhaenge : null,
  });
  if (insertError) throw new Error(insertError.message);

  if (zugeordneteVenueId) {
    await rueckeStatusAutomatischVor(
      zugeordneteVenueId,
      bandId,
      "kontaktiert",
      inZweiWochen()
    );
  }

  revalidatePath(`/emails/${bandId}`);
  return { ok: true };
}

export async function holeEingehendeEmails(
  bandId: string
): Promise<{ ok: true; neu: number } | { ok: false; fehler: string }> {
  const { data: konto, error } = await supabaseAdmin
    .from("band_email_konten")
    .select("*")
    .eq("band_id", bandId)
    .maybeSingle();

  if (error) return { ok: false, fehler: error.message };
  if (!konto?.email_adresse || !konto.passwort || !konto.imap_host) {
    return {
      ok: false,
      fehler: "IMAP-Einstellungen sind unvollständig (siehe Einstellungen).",
    };
  }

  const client = new ImapFlow({
    host: konto.imap_host,
    port: konto.imap_port ?? 993,
    secure: konto.imap_ssl,
    auth: { user: konto.email_adresse, pass: konto.passwort },
    logger: false,
  });

  type RohNachricht = {
    uid: string;
    von: string;
    vonAdresse: string;
    an: string;
    betreff: string;
    text: string;
    datum: string;
  };
  const gefunden: RohNachricht[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const gesamt =
        client.mailbox && typeof client.mailbox !== "boolean"
          ? client.mailbox.exists
          : 0;

      if (gesamt > 0) {
        // Nur die letzten 30 Nachrichten - reicht für einen Überblick,
        // ohne bei großen Postfächern extrem lange zu laden.
        const start = Math.max(1, gesamt - 29);
        for await (const msg of client.fetch(`${start}:*`, {
          uid: true,
          source: true,
        })) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const anAdresse = Array.isArray(parsed.to)
            ? parsed.to.map((t) => t.text).join(", ")
            : (parsed.to?.text ?? "");

          gefunden.push({
            uid: String(msg.uid),
            von: parsed.from?.text ?? "",
            vonAdresse: parsed.from?.value?.[0]?.address ?? "",
            an: anAdresse,
            betreff: parsed.subject ?? "(kein Betreff)",
            text: parsed.text ?? "",
            datum: (parsed.date ?? new Date()).toISOString(),
          });
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    try {
      client.close();
    } catch {
      // Verbindung war ohnehin schon defekt, nichts zu tun.
    }
    return {
      ok: false,
      fehler:
        err instanceof Error
          ? `Abruf fehlgeschlagen: ${err.message}`
          : "Abruf fehlgeschlagen.",
    };
  }

  const { data: bekannte } = await supabase
    .from("band_emails")
    .select("imap_uid")
    .eq("band_id", bandId)
    .eq("richtung", "empfangen");

  const bekannteUids = new Set((bekannte ?? []).map((b) => b.imap_uid));
  const neueNachrichten = gefunden.filter((m) => !bekannteUids.has(m.uid));

  if (neueNachrichten.length > 0) {
    const einzufuegend = await Promise.all(
      neueNachrichten.map(async (m) => ({
        band_id: bandId,
        venue_id: await findeVenueIdFuerAdresse(m.vonAdresse),
        richtung: "empfangen" as const,
        von: m.von,
        an: m.an,
        betreff: m.betreff,
        text_inhalt: m.text,
        imap_uid: m.uid,
        zeitpunkt: m.datum,
      }))
    );

    const { error: insertError } = await supabase
      .from("band_emails")
      .insert(einzufuegend);
    if (insertError) throw new Error(insertError.message);

    // Antwort eines zugeordneten Veranstalters: Nachfass-Timer stoppen (auf
    // `null` setzen) und je nach Inhalt in "interessiert" oder "abgesagt"
    // vorrücken.
    for (const eintrag of einzufuegend) {
      if (!eintrag.venue_id) continue;
      await rueckeStatusAutomatischVor(
        eintrag.venue_id,
        bandId,
        klassifiziereAntwort(eintrag.text_inhalt),
        null
      );
    }
  }

  revalidatePath(`/emails/${bandId}`);
  return { ok: true, neu: neueNachrichten.length };
}
