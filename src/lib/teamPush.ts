// BEWUSST KEIN "use server": internes Server-Modul, kein Aktions-Endpunkt.
// Diese Funktionen lagen bisher in teamActions.ts und wurden dadurch als
// Aktionen der oeffentlichen Team-Route registriert - ohne Login aufrufbar.
// loeseGigAnfrageAus haette so mit beliebiger Venue-ID Gig-Anfragen erzeugen
// und Push an alle Mitglieder ausloesen koennen (sendeTerminPush ebenso).
// Aufgerufen werden sie ausschliesslich serverseitig: aus actions.ts (Status-
// wechsel eines Kontakts) und terminActions.ts (neuer Termin). "server-only"
// laesst den Build scheitern, falls die Datei je in eine Client-Komponente
// importiert wird.
import "server-only";

import webpush from "web-push";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { KalenderTermin } from "@/lib/types";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:tobivogelsang@gmail.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
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

const TERMIN_TYP_PUSH_LABEL: Record<KalenderTermin["typ"], string> = {
  probe: "Probe",
  konzertmoeglichkeit: "Konzertmöglichkeit",
  event: "Event",
};

// Push an alle Band-Mitglieder, wenn ein neuer Termin angelegt wurde. Der
// Payload enthält terminId + vorkommenDatum (erstes Vorkommen), damit die
// Action-Buttons in der Mitteilung ("Ich kann"/"Ich kann nicht") direkt für
// dieses Vorkommen antworten können (Service Worker -> /api/team-termin-antwort).
export async function sendeTerminPush(bandId: string, termin: KalenderTermin) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const { data: mitglieder } = await supabaseAdmin
    .from("band_mitglieder")
    .select("id, push_endpoint, push_p256dh, push_auth")
    .eq("band_id", bandId);
  if (!mitglieder || mitglieder.length === 0) return;

  const datumText = termin.datum.split("-").reverse().join(".");
  const zeitText = termin.uhrzeit ? ` ${termin.uhrzeit.slice(0, 5)} Uhr` : "";
  const titel = `Neue ${TERMIN_TYP_PUSH_LABEL[termin.typ]}: ${termin.titel}`;
  const body = `${datumText}${zeitText}${termin.ort ? ` · ${termin.ort}` : ""}`;

  await Promise.all(
    mitglieder
      .filter((m) => m.push_endpoint && m.push_p256dh && m.push_auth)
      .map(async (m) => {
        const payload = JSON.stringify({
          title: titel,
          body,
          terminId: termin.id,
          vorkommenDatum: termin.datum,
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
          console.error(`Termin-Push an Mitglied ${m.id} fehlgeschlagen`, err);
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
