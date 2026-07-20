import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

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

// In jeder Inhaber-Server-Action aufrufen (Datensicherheit-Empfehlung der
// Next-Docs: nicht allein auf den Proxy verlassen). Wirft, wenn keine gültige
// Session vorliegt - die Team-App-Aktionen rufen das bewusst NICHT auf.
export async function requireOwner() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Nicht angemeldet.");
  }
  return user;
}
