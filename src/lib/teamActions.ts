"use server";

import webpush from "web-push";
import { revalidatePath } from "next/cache";
// service_role-Client (umgeht RLS). `supabase` und `supabaseAdmin` sind hier
// derselbe privilegierte Client. Achtung: Die meisten Funktionen hier sind
// bewusst ÖFFENTLICH (Team-App ohne Login) - nur die Inhaber-Funktionen
// (getMitgliederFuerBand, entferneMitglied) rufen requireOwner() auf.
import { supabaseAdmin, supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { requireOwner } from "@/lib/authServer";
import { getOffeneAnfragenFuerMitglied } from "@/lib/queries";
import { setzeStatusVorwaerts } from "@/lib/statusActions";
import type { GigAnfrageStatus, GigAntwort } from "@/lib/database.types";
import type { BandMitgliedOhnePush, OffeneAnfrageFuerMitglied } from "@/lib/types";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:tobivogelsang@gmail.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Legt ein neues Teammitglied an (einmalige Namenseingabe, kein Login/Passwort)
// inkl. Push-Subscription. subscription ist optional, falls jemand
// Benachrichtigungen ablehnt oder der Browser sie nicht unterstützt - die
// Person kann die Team-Seite trotzdem manuell nutzen. Läuft über den
// service_role-Client, da band_mitglieder bewusst keine anon-Policy hat
// (schützt die Push-Zugangsdaten).
export async function registriereMitglied(
  bandId: string,
  name: string,
  subscription: PushSubscriptionInput | null
): Promise<{ ok: true; mitgliedId: string } | { ok: false; fehler: string }> {
  if (!name.trim()) return { ok: false, fehler: "Name fehlt." };

  const { data, error } = await supabaseAdmin
    .from("band_mitglieder")
    .insert({
      band_id: bandId,
      name: name.trim(),
      push_endpoint: subscription?.endpoint ?? null,
      push_p256dh: subscription?.keys.p256dh ?? null,
      push_auth: subscription?.keys.auth ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, fehler: error.message };
  return { ok: true, mitgliedId: data.id };
}

// Hält die Push-Subscription eines bereits registrierten Mitglieds aktuell
// (Browser können die Subscription gelegentlich rotieren). Wird bei jedem
// App-Start im Hintergrund aufgerufen.
export async function aktualisierePushSubscription(
  mitgliedId: string,
  subscription: PushSubscriptionInput
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { error } = await supabaseAdmin
    .from("band_mitglieder")
    .update({
      push_endpoint: subscription.endpoint,
      push_p256dh: subscription.keys.p256dh,
      push_auth: subscription.keys.auth,
    })
    .eq("id", mitgliedId);

  if (error) return { ok: false, fehler: error.message };
  return { ok: true };
}

async function sendePushAnAlleMitglieder(
  bandId: string,
  venueId: string,
  anfrageId: string
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const [{ data: venue }, { data: mitglieder }] = await Promise.all([
    supabaseAdmin
      .from("venues")
      .select("name, veranstaltungsdatum")
      .eq("id", venueId)
      .maybeSingle(),
    supabaseAdmin
      .from("band_mitglieder")
      .select("id, push_endpoint, push_p256dh, push_auth")
      .eq("band_id", bandId),
  ]);

  if (!mitglieder || mitglieder.length === 0) return;

  const datumText = venue?.veranstaltungsdatum
    ? ` am ${venue.veranstaltungsdatum.split("-").reverse().join(".")}`
    : "";
  const titel = `Verfügbarkeit gefragt: ${venue?.name ?? "Neue Anfrage"}`;
  const body = `Könnt ihr${datumText}? Bitte bestätigen.`;

  await Promise.all(
    mitglieder
      .filter((m) => m.push_endpoint && m.push_p256dh && m.push_auth)
      .map(async (m) => {
        // mitgliedId wird pro Empfänger einzeln mitgeschickt, damit der
        // Service Worker beim Klick auf "Ich kann"/"Ich kann nicht" sofort
        // weiß, wer geantwortet hat, ohne die App öffnen zu müssen.
        const payload = JSON.stringify({
          title: titel,
          body,
          anfrageId,
          mitgliedId: m.id,
          bandId,
        });
        try {
          await webpush.sendNotification(
            {
              endpoint: m.push_endpoint!,
              keys: { p256dh: m.push_p256dh!, auth: m.push_auth! },
            },
            payload
          );
        } catch (err) {
          // Eine abgelaufene/ungültige Subscription (z. B. App deinstalliert)
          // darf den Push an die übrigen Mitglieder nicht blockieren.
          console.error(`Push an Mitglied ${m.id} fehlgeschlagen`, err);
        }
      })
  );
}

// Löst die automatische Team-Anfrage aus, sobald eine Band<->Venue-Beziehung
// auf Status "interessiert" wechselt. Verhindert Doppel-Anfragen, solange
// bereits eine offene Anfrage für dieselbe Kombination existiert.
export async function loeseGigAnfrageAus(venueId: string, bandId: string) {
  const { data: bestehende } = await supabaseAdmin
    .from("gig_anfragen")
    .select("id")
    .eq("venue_id", venueId)
    .eq("band_id", bandId)
    .eq("status", "offen")
    .maybeSingle();

  if (bestehende) return;

  const { data: neueAnfrage, error } = await supabaseAdmin
    .from("gig_anfragen")
    .insert({ venue_id: venueId, band_id: bandId })
    .select("id")
    .single();

  if (error || !neueAnfrage) return;

  await sendePushAnAlleMitglieder(bandId, venueId, neueAnfrage.id);

  revalidatePath("/");
  revalidatePath("/venues");
  revalidatePath(`/venues/${venueId}`);
  revalidatePath("/kalender");
}

// Schließt eine noch offene (unbeantwortete) Anfrage, wenn der Status eines
// Kontakts von "interessiert" wegwechselt (z. B. zurück auf "nachgefasst"
// oder weiter auf "gebucht"/"abgesagt"). Ohne das würde eine spätere
// Rückkehr zu "interessiert" fälschlich als Duplikat erkannt und keine neue
// Anfrage/Push ausgelöst, weil die alte, nie beantwortete Anfrage noch als
// "offen" gilt. Kein Fehler, falls gar keine offene Anfrage existiert.
export async function schliesseOffeneGigAnfrage(venueId: string, bandId: string) {
  await supabaseAdmin
    .from("gig_anfragen")
    .delete()
    .eq("venue_id", venueId)
    .eq("band_id", bandId)
    .eq("status", "offen");

  revalidatePath("/");
  revalidatePath("/venues");
  revalidatePath(`/venues/${venueId}`);
  revalidatePath("/kalender");
}

async function aktualisiereAnfrageStatus(anfrageId: string) {
  const { data: anfrage } = await supabaseAdmin
    .from("gig_anfragen")
    .select("band_id, venue_id")
    .eq("id", anfrageId)
    .maybeSingle();
  if (!anfrage) return;

  const [{ data: mitglieder }, { data: antworten }] = await Promise.all([
    supabaseAdmin.from("band_mitglieder").select("id").eq("band_id", anfrage.band_id),
    supabaseAdmin.from("gig_antworten").select("antwort").eq("anfrage_id", anfrageId),
  ]);

  const gesamt = mitglieder?.length ?? 0;
  const liste = antworten ?? [];
  const hatAbsage = liste.some((a) => a.antwort === "kann_nicht");
  const alleBestaetigt =
    gesamt > 0 && liste.length === gesamt && liste.every((a) => a.antwort === "kann");

  let neuerStatus: GigAnfrageStatus = "offen";
  if (hatAbsage) neuerStatus = "abgesagt";
  else if (alleBestaetigt) neuerStatus = "bestaetigt";

  await supabaseAdmin
    .from("gig_anfragen")
    .update({
      status: neuerStatus,
      abgeschlossen_am: neuerStatus === "offen" ? null : new Date().toISOString(),
    })
    .eq("id", anfrageId);

  // Sobald wirklich alle "Ich kann" bestätigt haben, ist Buchen die einzige
  // noch offene, nicht automatisierbare Aufgabe - der Kontakt rückt deshalb
  // automatisch auf "Bereit zu buchen" vor, damit das im Dashboard/der
  // Pipeline sofort auffällt.
  if (neuerStatus === "bestaetigt") {
    await setzeStatusVorwaerts(anfrage.venue_id, anfrage.band_id, "bereit_zu_buchen");
  }
}

// Speichert die Antwort eines Mitglieds ("kann"/"kann_nicht") und berechnet
// den Anfrage-Status neu. Ein Upsert erlaubt das nachträgliche Korrigieren
// einer Antwort.
export async function beantworteAnfrage(
  anfrageId: string,
  mitgliedId: string,
  antwort: GigAntwort
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { error } = await supabaseAdmin.from("gig_antworten").upsert(
    {
      anfrage_id: anfrageId,
      mitglied_id: mitgliedId,
      antwort,
      beantwortet_am: new Date().toISOString(),
    },
    { onConflict: "anfrage_id,mitglied_id" }
  );

  if (error) return { ok: false, fehler: error.message };

  await aktualisiereAnfrageStatus(anfrageId);

  revalidatePath("/");
  revalidatePath("/venues");
  revalidatePath("/pipeline");
  revalidatePath("/kalender");

  return { ok: true };
}

// getBandName wird für die Team-Startseite gebraucht (Anzeige "Willkommen bei
// <Band>"), ohne dass die Team-App Zugriff auf den gesamten Akquise-Bereich
// bekommt.
export async function getBandName(bandId: string): Promise<string | null> {
  const { data } = await supabase.from("bands").select("name").eq("id", bandId).maybeSingle();
  return data?.name ?? null;
}

// Registrierte Mitglieder einer Band, ohne Push-Zugangsdaten - für die
// Verwaltung auf der Band-Seite.
export async function getMitgliederFuerBand(
  bandId: string
): Promise<BandMitgliedOhnePush[]> {
  await requireOwner();
  const { data, error } = await supabaseAdmin
    .from("band_mitglieder")
    .select("id, band_id, name, erstellt_am")
    .eq("band_id", bandId)
    .order("erstellt_am");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Entfernt ein Mitglied (z. B. hat die Band verlassen oder doppelt
// registriert). Löscht per Kaskade auch seine bisherigen Antworten.
export async function entferneMitglied(mitgliedId: string, bandId: string) {
  await requireOwner();
  const { error } = await supabaseAdmin
    .from("band_mitglieder")
    .delete()
    .eq("id", mitgliedId);
  if (error) throw new Error(error.message);

  revalidatePath(`/einstellungen/${bandId}`);
}

// Dünner Server-Action-Wrapper um die Query aus queries.ts, damit die
// clientseitige Team-App offene Anfragen nachladen kann (z. B. nach dem
// Beantworten einer Anfrage).
export async function holeOffeneAnfragen(
  mitgliedId: string,
  bandId: string
): Promise<OffeneAnfrageFuerMitglied[]> {
  return getOffeneAnfragenFuerMitglied(mitgliedId, bandId);
}
