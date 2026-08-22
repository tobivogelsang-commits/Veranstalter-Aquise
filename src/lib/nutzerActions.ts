"use server";

import { createHash, randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  FREIGABE_BEREICHE,
  getAuthClient,
  requireAdmin,
  type FreigabeBereich,
} from "@/lib/authServer";

// Einladungs- und Nutzerverwaltung für das Desktop-Tool. Einladungen sind
// Einmal-Links: In der DB liegt nur der SHA-256-Hash des Tokens, der Klartext
// steht ausschließlich im Link, den der Admin selbst verschickt (WhatsApp,
// Mail, ...). Eingelöst = verbraucht_am gesetzt = Link ist tot.

const EINLADUNG_GUELTIG_TAGE = 7;
const RESET_GUELTIG_STUNDEN = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Interne Anmelde-Adresse eines Mitglieds. Die Domain ".invalid" ist per RFC
// für genau solche Zwecke reserviert - es kann nie echte Mail dorthin gehen.
// Nutzer sehen diese Adresse nirgends; sie melden sich per Benutzername an.
function interneEmail(): string {
  return `m-${randomBytes(8).toString("hex")}@mitglied.invalid`;
}

export type NutzerZeile = {
  user_id: string;
  benutzername: string;
  bereiche: Record<FreigabeBereich, boolean>;
};

export type OffeneEinladung = {
  id: string;
  zweck: "einladung" | "passwort_reset";
  benutzername: string | null;
  laeuft_ab: string;
};

// --- Admin: Übersicht -------------------------------------------------------

export async function getNutzerUebersicht(): Promise<{
  nutzer: NutzerZeile[];
  offeneEinladungen: OffeneEinladung[];
}> {
  await requireAdmin();

  const [freigaben, einladungen] = await Promise.all([
    supabaseAdmin
      .from("nutzer_freigaben")
      .select("*")
      .order("benutzername"),
    supabaseAdmin
      .from("einladungen")
      .select("*")
      .is("verbraucht_am", null)
      .gte("laeuft_ab", new Date().toISOString())
      .order("erstellt_am", { ascending: false }),
  ]);
  if (freigaben.error) throw new Error(freigaben.error.message);
  if (einladungen.error) throw new Error(einladungen.error.message);

  const nutzer: NutzerZeile[] = (freigaben.data ?? []).map((zeile) => ({
    user_id: zeile.user_id,
    benutzername: zeile.benutzername,
    bereiche: Object.fromEntries(
      FREIGABE_BEREICHE.map((b) => [b, zeile[b]])
    ) as Record<FreigabeBereich, boolean>,
  }));

  const nameJeUser = new Map(nutzer.map((n) => [n.user_id, n.benutzername]));
  const offeneEinladungen: OffeneEinladung[] = (einladungen.data ?? []).map(
    (e) => ({
      id: e.id,
      zweck: e.zweck,
      benutzername: e.user_id ? (nameJeUser.get(e.user_id) ?? null) : null,
      laeuft_ab: e.laeuft_ab,
    })
  );

  return { nutzer, offeneEinladungen };
}

// --- Admin: Einladung / Passwort-Reset erzeugen -----------------------------

// Erzeugt einen Einmal-Link. Rückgabe ist nur der Token-Pfad - die volle URL
// baut der Client aus window.location.origin, damit lokal und auf Vercel
// automatisch die richtige Adresse entsteht.
export async function erstelleEinladung(): Promise<
  { ok: true; pfad: string } | { ok: false; fehler: string }
> {
  await requireAdmin();

  const token = randomBytes(32).toString("base64url");
  const laeuftAb = new Date(
    Date.now() + EINLADUNG_GUELTIG_TAGE * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabaseAdmin.from("einladungen").insert({
    token_hash: hashToken(token),
    zweck: "einladung",
    laeuft_ab: laeuftAb,
  });
  if (error) return { ok: false, fehler: error.message };

  revalidatePath("/einstellungen");
  return { ok: true, pfad: `/einladung/${token}` };
}

export async function erstellePasswortReset(
  userId: string
): Promise<{ ok: true; pfad: string } | { ok: false; fehler: string }> {
  await requireAdmin();

  const token = randomBytes(32).toString("base64url");
  const laeuftAb = new Date(
    Date.now() + RESET_GUELTIG_STUNDEN * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabaseAdmin.from("einladungen").insert({
    token_hash: hashToken(token),
    zweck: "passwort_reset",
    user_id: userId,
    laeuft_ab: laeuftAb,
  });
  if (error) return { ok: false, fehler: error.message };

  revalidatePath("/einstellungen");
  return { ok: true, pfad: `/einladung/${token}` };
}

export async function widerrufeEinladung(
  einladungId: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireAdmin();

  const { error } = await supabaseAdmin
    .from("einladungen")
    .delete()
    .eq("id", einladungId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath("/einstellungen");
  return { ok: true };
}

// --- Admin: Freigaben setzen / Nutzer löschen -------------------------------

export async function setzeFreigabe(
  userId: string,
  bereich: FreigabeBereich,
  wert: boolean
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireAdmin();

  // Nur bekannte Spalten zulassen - bereich kommt vom Client.
  if (!FREIGABE_BEREICHE.includes(bereich)) {
    return { ok: false, fehler: "Unbekannter Bereich." };
  }

  const aenderung: Partial<Record<FreigabeBereich, boolean>> & {
    aktualisiert_am: string;
  } = { aktualisiert_am: new Date().toISOString() };
  aenderung[bereich] = wert;

  const { error } = await supabaseAdmin
    .from("nutzer_freigaben")
    .update(aenderung)
    .eq("user_id", userId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath("/einstellungen");
  return { ok: true };
}

export async function loescheNutzer(
  userId: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  await requireAdmin();

  // Admin-Konten sind vom Löschen ausgenommen - damit sich der Admin nicht
  // selbst (oder einen zweiten Admin) aus Versehen aussperrt.
  const { data: ziel } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (!ziel?.user) return { ok: false, fehler: "Nutzer nicht gefunden." };
  if (ziel.user.app_metadata?.rolle === "admin") {
    return { ok: false, fehler: "Admin-Konten können nicht gelöscht werden." };
  }

  // Löscht den Login; nutzer_freigaben und offene Reset-Links hängen per
  // ON DELETE CASCADE dran. Inhaltsdaten (Veranstalter, Termine, ...) bleiben.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, fehler: error.message };

  revalidatePath("/einstellungen");
  return { ok: true };
}

// --- Öffentlich: Einladung prüfen und einlösen ------------------------------

export type EinladungStatus =
  | { gueltig: true; zweck: "einladung" | "passwort_reset" }
  | { gueltig: false };

// Nur Anzeige-Prüfung für die Einladungsseite - verbraucht nichts.
export async function pruefeEinladung(token: string): Promise<EinladungStatus> {
  const { data } = await supabaseAdmin
    .from("einladungen")
    .select("zweck")
    .eq("token_hash", hashToken(token))
    .is("verbraucht_am", null)
    .gte("laeuft_ab", new Date().toISOString())
    .maybeSingle();
  return data ? { gueltig: true, zweck: data.zweck } : { gueltig: false };
}

function pruefeBenutzername(roh: string): string | { fehler: string } {
  const name = roh.trim();
  if (name.length < 2 || name.length > 40) {
    return { fehler: "Benutzername muss 2 bis 40 Zeichen lang sein." };
  }
  if (name.includes("@")) {
    return { fehler: "Benutzername darf kein @ enthalten." };
  }
  return name;
}

function pruefePasswort(passwort: string, wiederholung: string): string | null {
  if (passwort.length < 8) {
    return "Passwort muss mindestens 8 Zeichen lang sein.";
  }
  if (passwort !== wiederholung) {
    return "Die Passwörter stimmen nicht überein.";
  }
  return null;
}

// Verbraucht den Link atomar (Update nur, wenn noch unverbraucht und gültig) -
// zwei gleichzeitige Einlösungen können so nicht beide durchkommen.
async function verbraucheEinladung(
  token: string,
  zweck: "einladung" | "passwort_reset"
) {
  const { data } = await supabaseAdmin
    .from("einladungen")
    .update({ verbraucht_am: new Date().toISOString() })
    .eq("token_hash", hashToken(token))
    .eq("zweck", zweck)
    .is("verbraucht_am", null)
    .gte("laeuft_ab", new Date().toISOString())
    .select();
  return data?.[0] ?? null;
}

async function gebeEinladungFrei(einladungId: string) {
  await supabaseAdmin
    .from("einladungen")
    .update({ verbraucht_am: null })
    .eq("id", einladungId);
}

export type EinloesenState = { fehler: string } | undefined;

// Registrierung über einen Einladungslink: Benutzername + Passwort anlegen,
// direkt anmelden. Der neue Nutzer hat noch keine Freigaben und landet auf
// der "Warte auf Freigabe"-Seite.
export async function loeseEinladungEin(
  _prev: EinloesenState,
  formData: FormData
): Promise<EinloesenState> {
  const token = String(formData.get("token") ?? "");
  const nameOderFehler = pruefeBenutzername(
    String(formData.get("benutzername") ?? "")
  );
  if (typeof nameOderFehler !== "string") return nameOderFehler;
  const benutzername = nameOderFehler;

  const passwort = String(formData.get("passwort") ?? "");
  const passwortFehler = pruefePasswort(
    passwort,
    String(formData.get("wiederholung") ?? "")
  );
  if (passwortFehler) return { fehler: passwortFehler };

  // Verfügbarkeit vorab prüfen (der Unique-Index bleibt der Riegel darunter).
  const { data: vorhanden } = await supabaseAdmin
    .from("nutzer_freigaben")
    .select("user_id")
    .ilike("benutzername", benutzername)
    .maybeSingle();
  if (vorhanden) return { fehler: "Dieser Benutzername ist schon vergeben." };

  const einladung = await verbraucheEinladung(token, "einladung");
  if (!einladung) {
    return { fehler: "Dieser Link ist ungültig, abgelaufen oder schon benutzt." };
  }

  const email = interneEmail();
  const { data: neu, error: anlegenFehler } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: passwort,
      email_confirm: true,
    });
  if (anlegenFehler || !neu?.user) {
    await gebeEinladungFrei(einladung.id);
    return { fehler: "Konto konnte nicht angelegt werden. Bitte nochmal versuchen." };
  }

  const { error: freigabenFehler } = await supabaseAdmin
    .from("nutzer_freigaben")
    .insert({ user_id: neu.user.id, benutzername });
  if (freigabenFehler) {
    // Z. B. Benutzername-Rennen auf den Unique-Index: alles zurückrollen,
    // damit der Link weiter benutzbar bleibt.
    await supabaseAdmin.auth.admin.deleteUser(neu.user.id);
    await gebeEinladungFrei(einladung.id);
    return { fehler: "Dieser Benutzername ist schon vergeben." };
  }

  const client = await getAuthClient();
  await client.auth.signInWithPassword({ email, password: passwort });
  redirect("/keine-freigabe");
}

// Passwort-Reset über einen vom Admin verschickten Einmal-Link.
export async function loesePasswortResetEin(
  _prev: EinloesenState,
  formData: FormData
): Promise<EinloesenState> {
  const token = String(formData.get("token") ?? "");
  const passwort = String(formData.get("passwort") ?? "");
  const passwortFehler = pruefePasswort(
    passwort,
    String(formData.get("wiederholung") ?? "")
  );
  if (passwortFehler) return { fehler: passwortFehler };

  const einladung = await verbraucheEinladung(token, "passwort_reset");
  if (!einladung?.user_id) {
    return { fehler: "Dieser Link ist ungültig, abgelaufen oder schon benutzt." };
  }

  const { data: ziel, error } = await supabaseAdmin.auth.admin.updateUserById(
    einladung.user_id,
    { password: passwort }
  );
  if (error || !ziel?.user?.email) {
    await gebeEinladungFrei(einladung.id);
    return { fehler: "Passwort konnte nicht gesetzt werden. Bitte nochmal versuchen." };
  }

  const client = await getAuthClient();
  await client.auth.signInWithPassword({
    email: ziel.user.email,
    password: passwort,
  });
  redirect("/");
}
