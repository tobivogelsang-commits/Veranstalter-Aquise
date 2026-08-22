import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY müssen in .env.local gesetzt sein."
  );
}

// Per-Request Supabase-Client, der die Auth-Session aus den Cookies liest und
// (in Server Actions / im Proxy) aktualisiert. Nur für Login/Logout und die
// Session-Prüfung - der eigentliche Datenzugriff läuft über supabaseAdmin.
export async function getAuthClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // In Server Components sind Cookies read-only - das Setzen schlägt
          // dann fehl. Das ist unkritisch: der Proxy schreibt die rotierten
          // Session-Cookies bei jeder Navigation zurück.
        }
      },
    },
  });
}

// Memoisiert pro Render/Request: getUser() validiert das JWT serverseitig
// gegen Supabase Auth (nicht nur das Cookie), daher nur einmal pro Anfrage.
export const getSessionUser = cache(async () => {
  const client = await getAuthClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
});

// --- Freigaben-System -------------------------------------------------------
//
// Der Admin (Inhaber) ist über app_metadata.rolle = "admin" gekennzeichnet -
// nur über das Supabase-Dashboard/service_role setzbar, nicht aus der App.
// Alle anderen Nutzer haben einzelne Freigaben pro Bereich in der Tabelle
// nutzer_freigaben (Migration 0043). Kein Eintrag = keine Rechte (fail closed).

export { FREIGABE_BEREICHE, type FreigabeBereich } from "@/lib/freigabenBereiche";
import { FREIGABE_BEREICHE, type FreigabeBereich } from "@/lib/freigabenBereiche";

export type Freigaben = {
  istAdmin: boolean;
  bereiche: Record<FreigabeBereich, boolean>;
};

function istAdminUser(user: User): boolean {
  return user.app_metadata?.rolle === "admin";
}

// Freigaben des angemeldeten Nutzers, memoisiert pro Request. null = nicht
// angemeldet. Der Admin bekommt pauschal alles, ohne DB-Zugriff.
export const getFreigaben = cache(async (): Promise<Freigaben | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const alle = istAdminUser(user);
  const bereiche = Object.fromEntries(
    FREIGABE_BEREICHE.map((b) => [b, alle])
  ) as Record<FreigabeBereich, boolean>;
  if (alle) return { istAdmin: true, bereiche };

  const { data } = await supabaseAdmin
    .from("nutzer_freigaben")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (data) {
    for (const b of FREIGABE_BEREICHE) bereiche[b] = data[b];
  }
  return { istAdmin: false, bereiche };
});

// In jeder Server-Action aufrufen, die nur eine gültige Anmeldung braucht
// (Datensicherheit-Empfehlung der Next-Docs: nicht allein auf den Proxy
// verlassen). Die Team-App-Aktionen rufen das bewusst NICHT auf.
export async function requireAnmeldung() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Nicht angemeldet.");
  }
  return user;
}

// Für Aktionen, die fest dem Admin vorbehalten sind (Einstellungen,
// Band-Stammdaten, E-Mail-Zugangsdaten, Löschen, Nutzerverwaltung).
export async function requireAdmin() {
  const user = await requireAnmeldung();
  if (!istAdminUser(user)) {
    throw new Error("Nur für den Admin.");
  }
  return user;
}

// Für Aktionen eines freigebbaren Bereichs. Der Admin besteht immer.
export async function requireFreigabe(bereich: FreigabeBereich) {
  const user = await requireAnmeldung();
  const freigaben = await getFreigaben();
  if (!freigaben?.bereiche[bereich]) {
    throw new Error("Keine Freigabe für diesen Bereich.");
  }
  return user;
}

// Startseite je nach Freigaben - wohin ein Nutzer umgeleitet wird, der einen
// Bereich nicht sehen darf. Ohne jede Freigabe: die "Warte auf Freigabe"-Seite.
const BEREICH_ROUTEN: [FreigabeBereich, string][] = [
  ["akquise", "/"],
  ["emails_lesen", "/emails"],
  ["angebote_ansehen", "/angebote"],
  ["kalender", "/kalender"],
  ["setlisten", "/setliste"],
  ["merch", "/merch"],
  ["produktion", "/produktion"],
];

export function ersteErlaubteRoute(freigaben: Freigaben): string {
  const treffer = BEREICH_ROUTEN.find(([bereich]) => freigaben.bereiche[bereich]);
  return treffer ? treffer[1] : "/keine-freigabe";
}

// Seiten-Pendant zu requireFreigabe: leitet um statt zu werfen. Am Anfang
// jeder geschützten Seite aufrufen - die Datenabfragen der Seiten laufen über
// den service_role-Client, der Proxy prüft nur "angemeldet ja/nein".
export async function requireFreigabeSeite(bereich: FreigabeBereich) {
  const freigaben = await getFreigaben();
  if (!freigaben) redirect("/login");
  if (!freigaben.bereiche[bereich]) redirect(ersteErlaubteRoute(freigaben));
  return freigaben;
}

export async function requireAdminSeite() {
  const freigaben = await getFreigaben();
  if (!freigaben) redirect("/login");
  if (!freigaben.istAdmin) redirect(ersteErlaubteRoute(freigaben));
  return freigaben;
}
