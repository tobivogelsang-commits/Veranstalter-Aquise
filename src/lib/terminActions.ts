"use server";

// Selbst angelegte Kalender-Termine (Probe / Konzertmöglichkeit / Event).
// service_role-Client (umgeht RLS). BEWUSST OHNE requireOwner(): Termine dürfen
// auch Bandmitglieder in der Team-App anlegen/bearbeiten/löschen. Der Zugriff
// ist - wie bei den übrigen Team-Aktionen (beantworteAnfrage, registriereMitglied)
// - über den geheimen Band-Link gesichert, nicht über den Inhaber-Login. Am
// Desktop sitzt zusätzlich der Login-Proxy davor.
import { revalidatePath } from "next/cache";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { sendeTerminPush } from "@/lib/teamPush";
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

// Jede Aktion filtert zusaetzlich nach band_id: die bandId kam bisher nur fuer
// revalidatePath mit, sodass die Kenntnis einer fremden Termin-ID genuegte, um
// den Kalender einer anderen Band zu aendern oder zu loeschen. "Nicht
// gefunden" gilt gleichermassen fuer "existiert nicht" und "fremde Band",
// damit die Antwort die Existenz fremder IDs nicht verraet.
const FREMD = "Nicht gefunden.";

// termin_songs haengt nur am Termin und hat selbst keine band_id.
async function gehoertTerminZuBand(terminId: string, bandId: string) {
  const { data } = await supabase
    .from("kalender_termine")
    .select("id")
    .eq("id", terminId)
    .eq("band_id", bandId)
    .maybeSingle();
  return Boolean(data);
}

// ausnahmen bewusst ausgenommen: Bearbeiten fasst die Ausfall-Daten nicht an.
function bereinige(eingabe: TerminEingabe):
  | { ok: true; werte: Omit<KalenderTermin, "id" | "band_id" | "erstellt_am" | "ausnahmen"> }
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
    .eq("band_id", bandId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, fehler: error.message };
  if (!data) return { ok: false, fehler: FREMD };

  revalidiereKalender(bandId);
  return { ok: true, termin: data };
}

// Loeschen ist absichtlich idempotent: trifft der band_id-Filter nichts (ID
// existiert nicht oder gehoert einer anderen Band), wird nichts geloescht und
// trotzdem Erfolg gemeldet. Das verraet einem Fremden nicht, ob eine ID
// existiert, und ein zweiter Klick / zweites Geraet laeuft nicht in einen
// Fehler.
export async function loescheTermin(
  terminId: string,
  bandId: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { error } = await supabase
    .from("kalender_termine")
    .delete()
    .eq("id", terminId)
    .eq("band_id", bandId);
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
  if (!(await gehoertTerminZuBand(terminId, bandId))) {
    return { ok: false, fehler: FREMD };
  }

  // Auch die verplanten Songs/Produktionen/Setlisten muessen der Band gehoeren
  // - sonst liessen sich fremde Eintraege in den eigenen Proben-Plan haengen
  // und deren Namen darueber auslesen.
  const tabelleZuTyp = {
    song: "band_songs",
    produktion: "produktionen",
    setliste: "setlisten",
  } as const;

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

  for (const typ of ["song", "produktion", "setliste"] as const) {
    const ids = gueltige.filter((e) => e.typ === typ).map((e) => e.id);
    if (ids.length === 0) continue;
    const { data: eigene } = await supabase
      .from(tabelleZuTyp[typ])
      .select("id")
      .eq("band_id", bandId)
      .in("id", ids);
    const erlaubt = new Set((eigene ?? []).map((e) => e.id));
    if (ids.some((id) => !erlaubt.has(id))) {
      return { ok: false, fehler: FREMD };
    }
  }

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

// "Nur diesen Termin löschen" bei Serien: Das Datum wird als Ausnahme an der
// Serie vermerkt, die Kalender-Expansion überspringt es dann. Die Serie
// selbst (und alle anderen Vorkommen) bleiben bestehen.
export async function loescheTerminVorkommen(
  terminId: string,
  bandId: string,
  vorkommenDatum: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vorkommenDatum)) {
    return { ok: false, fehler: "Ungültiges Datum." };
  }

  const { data: termin, error: leseFehler } = await supabase
    .from("kalender_termine")
    .select("ausnahmen")
    .eq("id", terminId)
    .eq("band_id", bandId)
    .maybeSingle();
  if (leseFehler) return { ok: false, fehler: leseFehler.message };
  if (!termin) return { ok: false, fehler: "Termin nicht gefunden." };

  if (!termin.ausnahmen.includes(vorkommenDatum)) {
    const { error } = await supabase
      .from("kalender_termine")
      .update({ ausnahmen: [...termin.ausnahmen, vorkommenDatum] })
      .eq("id", terminId)
      .eq("band_id", bandId);
    if (error) return { ok: false, fehler: error.message };
  }

  revalidiereKalender(bandId);
  return { ok: true };
}
