"use server";

import { redirect } from "next/navigation";
import { getAuthClient } from "@/lib/authServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type LoginState = { fehler: string } | undefined;

const LOGIN_FEHLER =
  "Anmeldung fehlgeschlagen. Anmeldename oder Passwort falsch.";

// Meldet per Supabase Auth an und setzt die Session-Cookies. Der Admin nutzt
// seine E-Mail, Mitglieder ihren Benutzernamen (wird serverseitig auf die
// interne Supabase-Adresse aufgelöst). Signatur passend zu React
// useActionState (prevState, formData). Bewusst keine Details in der
// Fehlermeldung, um kein Benutzer-Enumeration-Signal zu geben.
export async function signIn(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const login = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const weiter = String(formData.get("weiter") ?? "");

  if (!login || !password) {
    return { fehler: "Anmeldename und Passwort sind erforderlich." };
  }

  // Enthält der Anmeldename ein @, ist es eine E-Mail (Admin). Sonst ein
  // Benutzername - Auflösung über die Freigaben-Tabelle, Vergleich wie beim
  // Unique-Index unabhängig von Groß-/Kleinschreibung.
  let email = login;
  if (!login.includes("@")) {
    const { data } = await supabaseAdmin
      .from("nutzer_freigaben")
      .select("user_id")
      .ilike("benutzername", login)
      .maybeSingle();
    if (!data) return { fehler: LOGIN_FEHLER };
    const { data: nutzer } = await supabaseAdmin.auth.admin.getUserById(
      data.user_id
    );
    if (!nutzer?.user?.email) return { fehler: LOGIN_FEHLER };
    email = nutzer.user.email;
  }

  const client = await getAuthClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { fehler: LOGIN_FEHLER };
  }

  // Nur interne Pfade als Weiterleitungsziel zulassen (kein Open Redirect).
  const ziel = weiter.startsWith("/") && !weiter.startsWith("//") ? weiter : "/";
  redirect(ziel);
}

export async function signOut() {
  const client = await getAuthClient();
  await client.auth.signOut();
  redirect("/login");
}
