"use server";

import { redirect } from "next/navigation";
import { getAuthClient } from "@/lib/authServer";

export type LoginState = { fehler: string } | undefined;

// Meldet den Inhaber per Supabase Auth (E-Mail + Passwort) an und setzt die
// Session-Cookies. Signatur passend zu React useActionState (prevState,
// formData). Bewusst keine Details in der Fehlermeldung, um kein
// Benutzer-Enumeration-Signal zu geben.
export async function signIn(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const weiter = String(formData.get("weiter") ?? "");

  if (!email || !password) {
    return { fehler: "E-Mail und Passwort sind erforderlich." };
  }

  const client = await getAuthClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { fehler: "Anmeldung fehlgeschlagen. E-Mail oder Passwort falsch." };
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
