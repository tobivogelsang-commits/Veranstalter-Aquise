"use server";

// Selbst angelegte Kalender-Termine (Probe / Konzertmöglichkeit / Event).
// service_role-Client (umgeht RLS). BEWUSST OHNE requireOwner(): Termine dürfen
// auch Bandmitglieder in der Team-App anlegen/bearbeiten/löschen. Der Zugriff
// ist - wie bei den übrigen Team-Aktionen (beantworteAnfrage, registriereMitglied)
// - über den geheimen Band-Link gesichert, nicht über den Inhaber-Login. Am
// Desktop sitzt zusätzlich der Login-Proxy davor.
import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { sendeTerminPush } from "@/lib/teamActions";
import type { KalenderTermin } from "@/lib/types";
import type { TerminTyp, TerminWiederholung } from "@/lib/database.types";

const ERLAUBTE_TYPEN: TerminTyp[] = ["probe", "konzertmoeglichkeit", "event"];
const ERLAUBTE_WIEDERHOLUNGEN: TerminWiederholung[] = [
  "einmalig",
  "woechentlich",
  "zweiwoechentlich",
  "monatlich",
];

export type TerminEingabe = {
  typ: TerminTyp;
  titel: string;
  datum: string;
  datumBis?: string | null;
  uhrzeit?: string | null;
  ort?: string | null;
  notiz?: string | null;
  wiederholung?: TerminWiederholung;
  wiederholungBis?: string | null;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UHRZEIT = /^\d{2}:\d{2}$/;

function bereinige(eingabe: TerminEingabe):
  | { ok: true; werte: Omit<KalenderTermin, "id" | "band_id" | "erstellt_am"> }
  | { ok: false; fehler: string } {
  const titel = eingabe.titel.trim();
  if (!titel) return { ok: false, fehler: "Titel fehlt." };
  if (!ERLAUBTE_TYPEN.includes(eingabe.typ)) return { ok: false, fehler: "Ungültiger Typ." };
  if (!ISO.test(eingabe.datum)) return { ok: false, fehler: "Datum fehlt." };

  const wiederholung = eingabe.wiederholung ?? "einmalig";
  if (!ERLAUBTE_WIEDERHOLUNGEN.includes(wiederholung)) {
    return { ok: false, fehler: "Ungültige Wiederholung." };
  }

  // Mehrtägig (datum_bis) nur bei einmaligen Terminen; Serien sind je Vorkommen
  // eintägig. wiederholung_bis begrenzt die Serie (optional).
  const einmalig = wiederholung === "einmalig";
  const datumBis = einmalig ? eingabe.datumBis?.trim() || null : null;
  const wiederholungBis = !einmalig ? eingabe.wiederholungBis?.trim() || null : null;

  if (datumBis && !ISO.test(datumBis)) {
    return { ok: false, fehler: "Enddatum ungültig." };
  }
  if (datumBis && datumBis < eingabe.datum) {
    return { ok: false, fehler: "Enddatum liegt vor dem Startdatum." };
  }
  if (wiederholungBis && !ISO.test(wiederholungBis)) {
    return { ok: false, fehler: "Wiederholungs-Enddatum ungültig." };
  }
  if (wiederholungBis && wiederholungBis < eingabe.datum) {
    return { ok: false, fehler: "Wiederholung endet vor dem Startdatum." };
  }

  const uhrzeit = eingabe.uhrzeit?.trim() || null;
  if (uhrzeit && !UHRZEIT.test(uhrzeit)) {
    return { ok: false, fehler: "Uhrzeit ungültig (HH:MM)." };
  }

  return {
    ok: true,
    werte: {
      typ: eingabe.typ,
      titel,
      datum: eingabe.datum,
      datum_bis: datumBis,
      uhrzeit,
      ort: eingabe.ort?.trim() || null,
      notiz: eingabe.notiz?.trim() || null,
      wiederholung,
      wiederholung_bis: wiederholungBis,
    },
  };
}

function revalidiereKalender(bandId: string) {
  revalidatePath("/kalender");
  revalidatePath(`/team/${bandId}`);
  revalidatePath("/");
}

export async function erstelleTermin(
  bandId: string,
  eingabe: TerminEingabe
): Promise<{ ok: true; termin: KalenderTermin } | { ok: false; fehler: string }> {
  const geprueft = bereinige(eingabe);
  if (!geprueft.ok) return geprueft;

  const { data, error } = await supabase
    .from("kalender_termine")
    .insert({ band_id: bandId, ...geprueft.werte })
    .select("*")
    .single();

  if (error) return { ok: false, fehler: error.message };

  // Alle Band-Mitglieder über den neuen Termin benachrichtigen (best effort -
  // ein Push-Fehler darf das Anlegen nicht scheitern lassen).
  await sendeTerminPush(bandId, data);

  revalidiereKalender(bandId);
  return { ok: true, termin: data };
}

export async function aktualisiereTermin(
  terminId: string,
  bandId: string,
  eingabe: TerminEingabe
): Promise<{ ok: true; termin: KalenderTermin } | { ok: false; fehler: string }> {
  const geprueft = bereinige(eingabe);
  if (!geprueft.ok) return geprueft;

  const { data, error } = await supabase
    .from("kalender_termine")
    .update(geprueft.werte)
    .eq("id", terminId)
    .select("*")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidiereKalender(bandId);
  return { ok: true, termin: data };
}

export async function loescheTermin(
  terminId: string,
  bandId: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { error } = await supabase.from("kalender_termine").delete().eq("id", terminId);
  if (error) return { ok: false, fehler: error.message };

  revalidiereKalender(bandId);
  return { ok: true };
}

// Ein zu speichernder Plan-Eintrag: Katalog-Song, Produktion oder Setliste.
export type TerminPlanEintragEingabe = {
  typ: "song" | "produktion" | "setliste";
  id: string;
};

// Ersetzt den kompletten Proben-Plan eines Vorkommens (wie bei
// speichereSetlistReihenfolge) - einfacher als Einzel-Updates, bei einer
// Handvoll Einträgen pro Probe unbedenklich.
export async function speichereTerminSongs(
  terminId: string,
  bandId: string,
  vorkommenDatum: string,
  eintraege: TerminPlanEintragEingabe[]
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { error: loeschFehler } = await supabase
    .from("termin_songs")
    .delete()
    .eq("termin_id", terminId)
    .eq("vorkommen_datum", vorkommenDatum);
  if (loeschFehler) return { ok: false, fehler: loeschFehler.message };

  // Unbekannte Typen verwerfen (Aktion ist öffentlich erreichbar).
  const gueltige = eintraege.filter((e) =>
    ["song", "produktion", "setliste"].includes(e.typ)
  );
  if (gueltige.length > 0) {
    const { error: einfuegeFehler } = await supabase.from("termin_songs").insert(
      gueltige.map((eintrag, index) => ({
        termin_id: terminId,
        vorkommen_datum: vorkommenDatum,
        song_id: eintrag.typ === "song" ? eintrag.id : null,
        produktion_id: eintrag.typ === "produktion" ? eintrag.id : null,
        setliste_id: eintrag.typ === "setliste" ? eintrag.id : null,
        position: index,
      }))
    );
    if (einfuegeFehler) return { ok: false, fehler: einfuegeFehler.message };
  }

  revalidiereKalender(bandId);
  return { ok: true };
}
