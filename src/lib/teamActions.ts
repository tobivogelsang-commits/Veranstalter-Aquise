"use server";

import { revalidatePath } from "next/cache";
// service_role-Client (umgeht RLS). `supabase` und `supabaseAdmin` sind hier
// derselbe privilegierte Client. Achtung: Die meisten Funktionen hier sind
// bewusst ÖFFENTLICH (Team-App ohne Login) - nur die Inhaber-Funktionen
// (getMitgliederFuerBand, entferneMitglied) rufen requireAnmeldung() auf.
import { supabaseAdmin, supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { requireAnmeldung, requireAdmin } from "@/lib/authServer";
import { getOffeneAnfragenFuerMitglied } from "@/lib/queries";
import { getTeamIconPfade, PASSWORT_MIN_LAENGE } from "@/lib/constants";
import { oeffentlicheBildUrl } from "@/lib/storage";
import { setzeStatusVorwaerts } from "@/lib/statusActions";
import { hashePasswort, passwortStimmt } from "@/lib/mitgliedPasswort";
import type { GigAnfrageStatus, GigAntwort } from "@/lib/database.types";
import type {
  BandMitgliedOhnePush,
  OffeneAnfrageFuerMitglied,
} from "@/lib/types";


export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Obergrenze pro Band. Die Registrierung ist ohne Login offen (jede/r mit dem
// Team-Link kann sich eintragen) - ohne Deckel könnte jemand die Tabelle
// beliebig vollschreiben und damit auch Push-Versand und "x von y bestätigt"
// unbrauchbar machen. Für eine Band ist das großzügig bemessen.
const MAX_MITGLIEDER_PRO_BAND = 50;
const MAX_NAME_LAENGE = 80;

// Die Team-App hat bewusst keinen Login: Ausweis ist die nicht erratbare
// Mitglieds-UUID. Diese Prüfung stellt sicher, dass eine Mitglieds-UUID nur
// innerhalb der eigenen Band wirkt - sonst könnte jemand mit einer fremden
// (oder aus einem anderen Kontext bekannten) Kombination Antworten für eine
// andere Band abgeben oder deren offene Anfragen auslesen.
async function gehoertMitgliedZuBand(
  mitgliedId: string,
  bandId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("band_mitglieder")
    .select("id")
    .eq("id", mitgliedId)
    .eq("band_id", bandId)
    .maybeSingle();
  return Boolean(data);
}

// Prüft, ob die auf dem Gerät gespeicherte Mitglieds-Identität noch existiert.
// Identitäten leben nur im localStorage des Geräts - wurde das Mitglied
// serverseitig entfernt (entferneMitglied), zeigt die App sonst dauerhaft
// eine tote Identität und das Registrierungs-Formular erscheint nie wieder.
// Bei Fehlern (z. B. Netzwerk) wird true zurückgegeben: im Zweifel NICHT
// abmelden, sonst würde ein transienter Ausfall alle Geräte ausloggen.
export async function pruefeMitglied(
  mitgliedId: string,
  bandId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("band_mitglieder")
    .select("id")
    .eq("id", mitgliedId)
    .eq("band_id", bandId)
    .maybeSingle();
  if (error) return true;
  return data !== null;
}

// Meldet ein Teammitglied an - dieselbe Aktion legt an ODER meldet auf einem
// weiteren Gerät an, je nachdem ob der Name in dieser Band schon existiert:
//
//  - Name frei          -> neues Mitglied, das eingegebene Passwort wird gesetzt
//  - Name existiert     -> Passwort wird geprüft; stimmt es, meldet sich die
//                          Person auf DIESEM Gerät an und bekommt ihren
//                          bestehenden Eintrag (keine zweite Karteikarte mehr)
//  - Name existiert, hat aber noch KEIN Passwort -> Mitglied aus der Zeit vor
//                          der Umstellung: das eingegebene Passwort wird
//                          uebernommen. Alle nachträglich zu zwingen wäre
//                          unnötig unfreundlich, und der Band-Link als
//                          Zugangsschutz gilt hier ohnehin weiterhin.
//
// Genau diese Zusammenführung verhindert die Doppelanmeldungen, durch die
// mehrere Mitglieder zweimal in der Teilnahmeliste standen.
// Läuft über den service_role-Client, da band_mitglieder bewusst keine
// anon-Policy hat (schützt Passwort-Hash und Push-Zugangsdaten).
export async function registriereMitglied(
  bandId: string,
  name: string,
  passwort: string,
  subscription: PushSubscriptionInput | null
): Promise<
  | { ok: true; mitgliedId: string; name: string; angemeldet: boolean }
  | { ok: false; fehler: string }
> {
  const sauberName = name.trim().slice(0, MAX_NAME_LAENGE);
  if (!sauberName) return { ok: false, fehler: "Name fehlt." };
  if (passwort.length < PASSWORT_MIN_LAENGE) {
    return {
      ok: false,
      fehler: `Passwort muss mindestens ${PASSWORT_MIN_LAENGE} Zeichen haben.`,
    };
  }

  // Existiert die Band überhaupt? Ohne Prüfung liefe man in einen rohen
  // Fremdschlüssel-Fehler, dessen Meldung nichts erklärt.
  const { data: band } = await supabaseAdmin
    .from("bands")
    .select("id, registrierung_offen")
    .eq("id", bandId)
    .maybeSingle();
  if (!band) return { ok: false, fehler: "Band nicht gefunden." };

  const pushFelder = {
    push_endpoint: subscription?.endpoint ?? null,
    push_p256dh: subscription?.keys.p256dh ?? null,
    push_auth: subscription?.keys.auth ?? null,
  };

  // Gibt es den Namen in dieser Band schon? Vergleich ohne Rücksicht auf
  // Gross-/Kleinschreibung, damit "cj" und "CJ" dieselbe Person sind.
  const { data: bestehende } = await supabaseAdmin
    .from("band_mitglieder")
    .select("id, name, passwort_hash")
    .eq("band_id", bandId)
    .ilike("name", sauberName);
  const vorhanden = (bestehende ?? []).find(
    (m) => m.name.trim().toLowerCase() === sauberName.toLowerCase()
  );

  if (vorhanden) {
    if (vorhanden.passwort_hash) {
      if (!(await passwortStimmt(passwort, vorhanden.passwort_hash))) {
        // Kleine Verzögerung, damit Passwörter nicht in schneller Folge
        // durchprobiert werden können.
        await new Promise((fertig) => setTimeout(fertig, 400));
        return {
          ok: false,
          fehler: "Dieser Name ist vergeben und das Passwort stimmt nicht.",
        };
      }
    } else {
      // Bestandsmitglied ohne Passwort: Das jetzt eingegebene wird seins.
      await supabaseAdmin
        .from("band_mitglieder")
        .update({ passwort_hash: await hashePasswort(passwort) })
        .eq("id", vorhanden.id);
    }

    // Anmeldung auf diesem Gerät: Push-Daten gehören ab jetzt hierher.
    await supabaseAdmin
      .from("band_mitglieder")
      .update(pushFelder)
      .eq("id", vorhanden.id);
    return {
      ok: true,
      mitgliedId: vorhanden.id,
      name: vorhanden.name,
      angemeldet: true,
    };
  }

  // Ab hier: NEUES Mitglied. Die Sperre greift bewusst erst an dieser Stelle -
  // bestehende Mitglieder (oben behandelt) sollen sich weiterhin anmelden
  // koennen, auch auf einem neuen Geraet. Sonst waere ein verlorenes Handy
  // gleichbedeutend mit dem Verlust des Zugangs.
  if (!band.registrierung_offen) {
    return {
      ok: false,
      fehler:
        "Für diese Band sind keine neuen Anmeldungen möglich. Melde dich bei der Band, wenn du dabei sein solltest.",
    };
  }

  const { count } = await supabaseAdmin
    .from("band_mitglieder")
    .select("id", { count: "exact", head: true })
    .eq("band_id", bandId);
  if ((count ?? 0) >= MAX_MITGLIEDER_PRO_BAND) {
    return {
      ok: false,
      fehler: "Diese Band hat bereits die maximale Anzahl an Mitgliedern.",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("band_mitglieder")
    .insert({
      band_id: bandId,
      name: sauberName,
      passwort_hash: await hashePasswort(passwort),
      ...pushFelder,
    })
    .select("id, name")
    .single();

  // 23505 = der Unique-Index hat zugeschlagen: In der Zeit zwischen Prüfung und
  // Einfügen hat sich derselbe Name eingetragen (zwei Geräte gleichzeitig).
  if (error) {
    return {
      ok: false,
      fehler:
        error.code === "23505"
          ? "Dieser Name wurde gerade vergeben. Bitte nochmal mit deinem Passwort anmelden."
          : error.message,
    };
  }
  return { ok: true, mitgliedId: data.id, name: data.name, angemeldet: false };
}

// Schaltet die Selbstregistrierung fuer eine Band an oder aus (Inhaber, am
// Desktop). Zugeschaltet kommt niemand Neues mehr hinein - auch niemand, der
// gerade entfernt wurde. Bestehende Mitglieder sind davon nicht betroffen.
export async function setzeRegistrierungOffen(
  bandId: string,
  offen: boolean
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("bands")
    .update({ registrierung_offen: offen })
    .eq("id", bandId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/einstellungen/${bandId}`);
  return { ok: true };
}

// Setzt das Passwort eines Mitglieds zurück (Inhaber, am Desktop): Der Hash
// wird geleert, die nächste Anmeldung mit diesem Namen vergibt ein neues.
// Für den Fall "Passwort vergessen" - niemand kann es auslesen, auch nicht
// der Inhaber.
export async function setzeMitgliedPasswortZurueck(
  mitgliedId: string,
  bandId: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("band_mitglieder")
    .update({ passwort_hash: null })
    .eq("id", mitgliedId)
    .eq("band_id", bandId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/einstellungen/${bandId}`);
  return { ok: true };
}

// Hält die Push-Subscription eines bereits registrierten Mitglieds aktuell
// (Browser können die Subscription gelegentlich rotieren). Wird bei jedem
// App-Start im Hintergrund aufgerufen.
export async function aktualisierePushSubscription(
  mitgliedId: string,
  bandId: string,
  subscription: PushSubscriptionInput
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  // Ohne diese Prüfung könnte man mit einer fremden Mitglieds-Kennung dessen
  // Push-Anmeldung überschreiben und so seine Benachrichtigungen auf das
  // eigene Gerät umleiten.
  if (!(await gehoertMitgliedZuBand(mitgliedId, bandId))) {
    return { ok: false, fehler: "Mitglied gehört nicht zu dieser Band." };
  }

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
  if (antwort !== "kann" && antwort !== "kann_nicht") {
    return { ok: false, fehler: "Ungültige Antwort." };
  }

  // Ohne diese Prüfung könnte jede/r mit einer beliebigen Anfrage- und
  // Mitglieds-UUID Antworten fälschen - und da eine vollständige Zusage den
  // Kontakt automatisch auf "Bereit zu buchen" vorrücken lässt, ließe sich so
  // die Pipeline von außen manipulieren.
  const { data: anfrage } = await supabaseAdmin
    .from("gig_anfragen")
    .select("band_id")
    .eq("id", anfrageId)
    .maybeSingle();

  // Bewusst dieselbe Meldung für "gibt es nicht" und "gehört nicht zu deiner
  // Band": Sonst verriete die Antwort, welche Anfrage-IDs existieren.
  const abweisung = {
    ok: false as const,
    fehler: "Anfrage nicht gefunden.",
  };
  if (!anfrage) return abweisung;
  if (!(await gehoertMitgliedZuBand(mitgliedId, anfrage.band_id))) {
    return abweisung;
  }

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
  await requireAnmeldung();
  const { data, error } = await supabaseAdmin
    .from("band_mitglieder")
    .select("id, band_id, name, erstellt_am, passwort_hash")
    .eq("band_id", bandId)
    .order("erstellt_am");

  if (error) throw new Error(error.message);
  // Den Hash selbst nicht weiterreichen - nur, ob einer gesetzt ist.
  return (data ?? []).map(({ passwort_hash, ...rest }) => ({
    ...rest,
    hat_passwort: passwort_hash !== null,
  }));
}

// Entfernt ein Mitglied (z. B. hat die Band verlassen oder doppelt
// registriert). Löscht per Kaskade auch seine bisherigen Antworten.
export async function entferneMitglied(mitgliedId: string, bandId: string) {
  await requireAdmin();
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
  // Ohne diese Prüfung könnte man mit einer beliebigen Mitglieds-UUID die
  // offenen Anfragen einer fremden Band abrufen (inkl. Veranstaltername,
  // Ort und Datum). Leere Liste statt Fehler - die Team-App zeigt dann
  // schlicht nichts an.
  if (!(await gehoertMitgliedZuBand(mitgliedId, bandId))) return [];
  return getOffeneAnfragenFuerMitglied(mitgliedId, bandId);
}

// --- Termin-Teilnahme (B3): Zu-/Absage pro einzelnem Vorkommen ---

export type TerminAntwortEintrag = {
  terminId: string;
  vorkommenDatum: string;
  antwort: GigAntwort;
};

// Speichert die Zu-/Absage eines Mitglieds für EIN Vorkommen eines Termins
// (Termin + Datum). Öffentlich (Team-App ohne Login), aber gegen gefälschte
// UUIDs abgesichert: Termin und Mitglied müssen zur angegebenen Band gehören.
export async function beantworteTermin(
  terminId: string,
  vorkommenDatum: string,
  mitgliedId: string,
  bandId: string,
  antwort: GigAntwort
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  if (antwort !== "kann" && antwort !== "kann_nicht") {
    return { ok: false, fehler: "Ungültige Antwort." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vorkommenDatum)) {
    return { ok: false, fehler: "Ungültiges Datum." };
  }

  const { data: termin } = await supabaseAdmin
    .from("kalender_termine")
    .select("band_id")
    .eq("id", terminId)
    .maybeSingle();
  const abweisung = { ok: false as const, fehler: "Termin nicht gefunden." };
  if (!termin || termin.band_id !== bandId) return abweisung;
  if (!(await gehoertMitgliedZuBand(mitgliedId, bandId))) return abweisung;

  const { error } = await supabaseAdmin.from("termin_antworten").upsert(
    {
      termin_id: terminId,
      mitglied_id: mitgliedId,
      vorkommen_datum: vorkommenDatum,
      antwort,
      beantwortet_am: new Date().toISOString(),
    },
    { onConflict: "termin_id,vorkommen_datum,mitglied_id" }
  );
  if (error) return { ok: false, fehler: error.message };

  revalidatePath(`/team/${bandId}`);
  revalidatePath("/kalender");
  return { ok: true };
}

// Alle bisherigen Termin-Antworten eines Mitglieds (für die Anzeige des
// eigenen Status in der Team-App). Nur die eigene Band.
export async function holeTerminAntworten(
  mitgliedId: string,
  bandId: string
): Promise<TerminAntwortEintrag[]> {
  if (!(await gehoertMitgliedZuBand(mitgliedId, bandId))) return [];
  const { data, error } = await supabaseAdmin
    .from("termin_antworten")
    .select("termin_id, vorkommen_datum, antwort")
    .eq("mitglied_id", mitgliedId);
  if (error) return [];
  return (data ?? []).map((r) => ({
    terminId: r.termin_id,
    vorkommenDatum: r.vorkommen_datum,
    antwort: r.antwort as GigAntwort,
  }));
}

// Bild der Band für Team-App und Home-Bildschirm-Icon. Reihenfolge:
// 1. selbst hochgeladenes Logo (öffentliche URL, gilt für jede neue Band
//    automatisch), 2. die alte fest hinterlegte Icon-Datei (Bestandsschutz
//    für Trash Back), 3. nichts - der Aufrufer nimmt dann das Standard-Icon.
export async function getBandLogoUrl(bandId: string): Promise<string | null> {
  const { data } = await supabase
    .from("bands")
    .select("logo_pfad")
    .eq("id", bandId)
    .maybeSingle();

  if (data?.logo_pfad) return oeffentlicheBildUrl(data.logo_pfad);
  return getTeamIconPfade(bandId)?.klein ?? null;
}
