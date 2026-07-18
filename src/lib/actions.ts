"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { STATUS_ORDER } from "@/lib/constants";
import { extrahiereStrasse } from "@/lib/adresse";
import { loeseGigAnfrageAus, schliesseOffeneGigAnfrage } from "@/lib/teamActions";
import type { Status, VenueTyp } from "@/lib/database.types";

function str(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function venueFieldsFromForm(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    typ: str(formData, "typ") as VenueTyp | null,
    ort: str(formData, "ort"),
    region: str(formData, "region"),
    strasse: str(formData, "strasse"),
    website: str(formData, "website"),
    ansprechpartner: str(formData, "ansprechpartner"),
    email: str(formData, "email"),
    telefon: str(formData, "telefon"),
    quelle: str(formData, "quelle"),
    notizen: str(formData, "notizen"),
    veranstaltungsdatum: str(formData, "veranstaltungsdatum"),
  };
}

// Legt für jede im Formular übergebene Band eine Zuordnung an, aktualisiert
// sie oder löscht sie, je nachdem ob die Band-Checkbox gesetzt ist. Bei einer
// echten Statusänderung wird `letzter_kontakt_am` automatisch auf jetzt gesetzt.
async function syncBandZuordnungen(
  venueId: string,
  bandIds: string[],
  formData: FormData,
  bestehende: { band_id: string; status: Status }[]
) {
  for (const bandId of bandIds) {
    const linked = formData.get(`band_${bandId}_linked`) === "on";
    const bestehendeRelation = bestehende.find((r) => r.band_id === bandId);

    if (!linked) {
      if (bestehendeRelation) {
        await supabase
          .from("venue_band_status")
          .delete()
          .eq("venue_id", venueId)
          .eq("band_id", bandId);
      }
      continue;
    }

    const status = (str(formData, `band_${bandId}_status`) ?? "neu") as Status;
    const naechsterFollowUp = str(formData, `band_${bandId}_follow_up`);

    if (!bestehendeRelation) {
      const { error } = await supabase.from("venue_band_status").insert({
        venue_id: venueId,
        band_id: bandId,
        status,
        letzter_kontakt_am: new Date().toISOString(),
        naechster_follow_up_am: naechsterFollowUp,
      });
      if (error) throw new Error(error.message);
      if (status === "interessiert") {
        await loeseGigAnfrageAus(venueId, bandId);
      } else {
        await schliesseOffeneGigAnfrage(venueId, bandId);
      }
    } else {
      const statusGeaendert = bestehendeRelation.status !== status;
      const { error } = await supabase
        .from("venue_band_status")
        .update({
          status,
          naechster_follow_up_am: naechsterFollowUp,
          ...(statusGeaendert
            ? { letzter_kontakt_am: new Date().toISOString() }
            : {}),
        })
        .eq("venue_id", venueId)
        .eq("band_id", bandId);
      if (error) throw new Error(error.message);
      if (statusGeaendert) {
        if (status === "interessiert") {
          await loeseGigAnfrageAus(venueId, bandId);
        } else {
          await schliesseOffeneGigAnfrage(venueId, bandId);
        }
      }
    }
  }
}

export async function createVenue(formData: FormData) {
  const felder = venueFieldsFromForm(formData);
  if (!felder.name) throw new Error("Name ist ein Pflichtfeld.");

  const { data: venue, error } = await supabase
    .from("venues")
    .insert(felder)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { data: bands } = await supabase.from("bands").select("id");
  await syncBandZuordnungen(venue.id, (bands ?? []).map((b) => b.id), formData, []);

  revalidatePath("/");
  revalidatePath("/venues");
  revalidatePath("/pipeline");
  redirect(`/venues/${venue.id}`);
}

export async function updateVenue(venueId: string, formData: FormData) {
  const felder = venueFieldsFromForm(formData);
  if (!felder.name) throw new Error("Name ist ein Pflichtfeld.");

  const { error } = await supabase
    .from("venues")
    .update({ ...felder, updated_at: new Date().toISOString() })
    .eq("id", venueId);
  if (error) throw new Error(error.message);

  const { data: bands } = await supabase.from("bands").select("id");
  const { data: bestehende } = await supabase
    .from("venue_band_status")
    .select("band_id, status")
    .eq("venue_id", venueId);

  await syncBandZuordnungen(
    venueId,
    (bands ?? []).map((b) => b.id),
    formData,
    bestehende ?? []
  );

  revalidatePath("/");
  revalidatePath("/venues");
  revalidatePath("/pipeline");
  revalidatePath(`/venues/${venueId}`);
  redirect(`/venues/${venueId}?gespeichert=1`);
}

export async function deleteVenue(venueId: string) {
  const { error } = await supabase.from("venues").delete().eq("id", venueId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/venues");
  revalidatePath("/pipeline");
  redirect("/venues");
}

export type KontaktRechercheErgebnis = {
  website: string | null;
  telefon: string | null;
  email: string | null;
  adresse: string | null;
  quelleUrl: string | null;
  quelleTitel: string | null;
  ausschnitt: string | null;
};

export type KontaktRechercheResult =
  | { ok: true; daten: KontaktRechercheErgebnis }
  | { ok: false; fehler: string };

// Google liefert Telefon/E-Mail nur selten als eigenes Feld (nur bei
// Knowledge-Graph/Maps-Treffern) - meistens stehen sie nur als Text im
// Suchausschnitt (z. B. "Telefon: 02173/794-0. E-Mail: info@stadt.de").
// Diese Fallback-Extraktion holt sie da heraus, wenn kein strukturiertes
// Feld verfügbar ist.
function extrahiereEmailAusText(text: string | null | undefined): string | null {
  if (!text) return null;
  const treffer = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return treffer?.[0] ?? null;
}

function extrahiereTelefonAusText(text: string | null | undefined): string | null {
  if (!text) return null;
  const treffer = text.match(/Tel(?:efon)?\.?:?\s*([+\d][\d\s()/-]{5,}\d)/i);
  return treffer?.[1]?.trim() ?? null;
}

// Sucht per SerpApi (Google-Suche) nach Kontaktdaten für einen Veranstalter.
// Füllt bewusst nur hochsichere Felder (Website/Telefon/E-Mail) und liefert
// den Rest (Adresse, Quelle, Textausschnitt) zur manuellen Prüfung, statt
// unsichere Daten (Ansprechpartner) automatisch zu raten.
export async function rechercheKontakt(
  name: string,
  ort: string | null
): Promise<KontaktRechercheResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return {
      ok: false,
      fehler: "SERPAPI_KEY ist nicht konfiguriert (.env.local).",
    };
  }
  if (!name.trim()) {
    return { ok: false, fehler: "Name fehlt." };
  }

  const query = `${name} ${ort ?? ""} Kontakt Booking Veranstaltungen`.trim();
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "de");
  url.searchParams.set("gl", "de");
  url.searchParams.set("num", "5");
  url.searchParams.set("api_key", apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    return { ok: false, fehler: "SerpApi war nicht erreichbar." };
  }

  if (!response.ok) {
    return { ok: false, fehler: `SerpApi-Fehler (${response.status}).` };
  }

  const json = await response.json();
  const place = json.local_results?.places?.[0];
  const kg = json.knowledge_graph;
  const erster = json.organic_results?.[0];

  const ausschnitt = erster?.snippet ?? null;

  const daten: KontaktRechercheErgebnis = {
    website:
      place?.links?.website ?? place?.website ?? kg?.website ?? erster?.link ?? null,
    telefon: place?.phone ?? kg?.phone ?? extrahiereTelefonAusText(ausschnitt),
    email: extrahiereEmailAusText(ausschnitt),
    adresse:
      extrahiereStrasse(place?.address ?? kg?.address ?? null) ??
      extrahiereStrasse(ausschnitt),
    quelleUrl: erster?.link ?? place?.links?.website ?? null,
    quelleTitel: erster?.title ?? place?.title ?? null,
    ausschnitt,
  };

  const nichtsGefunden =
    !daten.website &&
    !daten.telefon &&
    !daten.email &&
    !daten.adresse &&
    !daten.ausschnitt;
  if (nichtsGefunden) {
    return { ok: false, fehler: "Keine verwertbaren Ergebnisse gefunden." };
  }

  return { ok: true, daten };
}

export type RechercheTreffer = {
  title: string;
  typen: string | null;
  adresse: string | null;
  telefon: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  datum: string | null;
  beschreibung: string | null;
  quelleEngine: "events" | "maps" | "web";
};

export type VeranstalterSucheResult =
  | { ok: true; treffer: RechercheTreffer[]; hinweis?: string }
  | { ok: false; fehler: string; leer?: boolean };

// Festival/Stadtfest sind wiederkehrende, datierte Veranstaltungen -> Google
// Events (mit Termin). Club/Firmenevent/Hochzeit/Sonstiges sind feste
// Locations -> Google Maps (mit Adresse/Kategorie, aber ohne Termin).
const EVENT_TYPEN = new Set(["Festival", "Stadtfest"]);

async function sucheGoogleEvents(
  query: string,
  apiKey: string
): Promise<VeranstalterSucheResult> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_events");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "de");
  url.searchParams.set("gl", "de");
  url.searchParams.set("api_key", apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    return { ok: false, fehler: "SerpApi war nicht erreichbar." };
  }
  if (!response.ok) {
    return { ok: false, fehler: `SerpApi-Fehler (${response.status}).` };
  }

  const json = await response.json();
  const ergebnisse = Array.isArray(json.events_results) ? json.events_results : [];

  if (ergebnisse.length === 0) {
    return { ok: false, fehler: "Keine Google-Events-Treffer.", leer: true };
  }

  const treffer: RechercheTreffer[] = ergebnisse.slice(0, 20).map(
    (r: {
      title?: string;
      address?: string[];
      link?: string;
      date?: { when?: string; start_date?: string };
      venue?: { name?: string; rating?: number };
      description?: string;
    }) => ({
      title: r.title ?? "Unbenannt",
      typen: r.venue?.name ?? null,
      adresse: Array.isArray(r.address) ? r.address.join(", ") : null,
      telefon: null,
      website: r.link ?? null,
      rating: typeof r.venue?.rating === "number" ? r.venue.rating : null,
      reviews: null,
      datum: r.date?.when ?? r.date?.start_date ?? null,
      beschreibung: r.description ?? null,
      quelleEngine: "events" as const,
    })
  );

  return { ok: true, treffer };
}

async function sucheGoogleMaps(
  query: string,
  apiKey: string
): Promise<VeranstalterSucheResult> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "search");
  url.searchParams.set("hl", "de");
  url.searchParams.set("gl", "de");
  url.searchParams.set("api_key", apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    return { ok: false, fehler: "SerpApi war nicht erreichbar." };
  }
  if (!response.ok) {
    return { ok: false, fehler: `SerpApi-Fehler (${response.status}).` };
  }

  const json = await response.json();
  const ergebnisse = Array.isArray(json.local_results) ? json.local_results : [];

  if (ergebnisse.length === 0) {
    return { ok: false, fehler: "Keine Ergebnisse gefunden.", leer: true };
  }

  const treffer: RechercheTreffer[] = ergebnisse.slice(0, 20).map(
    (r: {
      title?: string;
      types?: string[];
      type?: string;
      address?: string;
      phone?: string;
      website?: string;
      rating?: number;
      reviews?: number;
      description?: string;
    }) => ({
      title: r.title ?? "Unbenannt",
      typen: Array.isArray(r.types) ? r.types.join(", ") : r.type ?? null,
      adresse: r.address ?? null,
      telefon: r.phone ?? null,
      website: r.website ?? null,
      rating: typeof r.rating === "number" ? r.rating : null,
      reviews: typeof r.reviews === "number" ? r.reviews : null,
      datum: null,
      beschreibung: r.description ?? null,
      quelleEngine: "maps" as const,
    })
  );

  return { ok: true, treffer };
}

// Fallback für Festival/Stadtfest, wenn Google Events nichts findet: viele
// kleinere/wiederkehrende Stadtfeste (z. B. kostenlose wöchentliche Reihen)
// sind dort nicht gelistet, tauchen aber in der normalen Websuche auf
// (offizielle Seite, Lokalpresse, Facebook) - Termine dann nur als Text im
// Ausschnitt statt strukturiert.
async function sucheGoogleWeb(
  query: string,
  apiKey: string
): Promise<VeranstalterSucheResult> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "de");
  url.searchParams.set("gl", "de");
  url.searchParams.set("num", "10");
  url.searchParams.set("api_key", apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    return { ok: false, fehler: "SerpApi war nicht erreichbar." };
  }
  if (!response.ok) {
    return { ok: false, fehler: `SerpApi-Fehler (${response.status}).` };
  }

  const json = await response.json();
  const ergebnisse = Array.isArray(json.organic_results) ? json.organic_results : [];

  if (ergebnisse.length === 0) {
    return { ok: false, fehler: "Keine Ergebnisse gefunden." };
  }

  const treffer: RechercheTreffer[] = ergebnisse.slice(0, 10).map(
    (r: { title?: string; link?: string; snippet?: string }) => ({
      title: r.title ?? "Unbenannt",
      typen: null,
      adresse: null,
      telefon: null,
      website: r.link ?? null,
      rating: null,
      reviews: null,
      datum: null,
      beschreibung: r.snippet ?? null,
      quelleEngine: "web" as const,
    })
  );

  return { ok: true, treffer };
}

// Ohne festgelegten Typ (Nutzer hat z. B. nur einen Veranstaltungsnamen
// gesehen und weiß nicht, ob es ein Festival, Stadtfest oder Club ist): keine
// der drei Quellen ist zuverlässig immer die richtige (Events findet z. B.
// generische Events in der Nähe statt des gesuchten Namens, Maps findet
// Locations aber keine Termine, Websuche findet fast alles per Name aber
// unstrukturiert) - deshalb alle drei parallel abfragen und kombiniert
// anzeigen, statt zu raten. Kostet bis zu 3 API-Calls statt 1.
async function sucheAutoAlleTypen(
  query: string,
  apiKey: string
): Promise<VeranstalterSucheResult> {
  const [events, maps, web] = await Promise.all([
    sucheGoogleEvents(query, apiKey),
    sucheGoogleMaps(query, apiKey),
    sucheGoogleWeb(query, apiKey),
  ]);

  const treffer: RechercheTreffer[] = [
    ...(events.ok ? events.treffer : []),
    ...(maps.ok ? maps.treffer : []),
    ...(web.ok ? web.treffer : []),
  ];

  if (treffer.length === 0) {
    return {
      ok: false,
      fehler: "Keine Ergebnisse gefunden (Google Events, Maps und Websuche).",
    };
  }

  const quellen = [
    events.ok ? "Google Events" : null,
    maps.ok ? "Google Maps" : null,
    web.ok ? "Websuche" : null,
  ].filter((q): q is string => q !== null);

  return {
    ok: true,
    treffer,
    hinweis: `Kein Typ festgelegt - Treffer kombiniert aus: ${quellen.join(", ")}. Bitte pro Treffer die passende Kategorie prüfen/wählen.`,
  };
}

// Findet neue Veranstalter über SerpApi anhand von Typ + Ort. Liefert eine
// Trefferliste zur Auswahl, statt automatisch etwas anzulegen. Typ ist
// optional ("" = alle Typen, z. B. wenn man eine gesehene Veranstaltung
// gezielt sucht und die Kategorie erst nach dem Suchergebnis feststehen soll).
export async function sucheVeranstalter(
  typ: string,
  ort: string,
  zusatz: string
): Promise<VeranstalterSucheResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return {
      ok: false,
      fehler: "SERPAPI_KEY ist nicht konfiguriert (.env.local).",
    };
  }
  if (!ort.trim()) {
    return { ok: false, fehler: "Ort/Region ist ein Pflichtfeld." };
  }

  const query = [typ, zusatz, ort].filter((teil) => teil?.trim()).join(" ");

  if (!typ) {
    return sucheAutoAlleTypen(query, apiKey);
  }

  if (!EVENT_TYPEN.has(typ)) {
    return sucheGoogleMaps(query, apiKey);
  }

  const events = await sucheGoogleEvents(query, apiKey);
  if (events.ok || !events.leer) return events;

  const web = await sucheGoogleWeb(query, apiKey);
  if (web.ok) {
    return {
      ...web,
      hinweis:
        "Keine strukturierten Google-Events-Treffer - stattdessen normale Websuche. Termine ggf. nur im Textausschnitt erkennbar, bitte prüfen.",
    };
  }
  return web;
}

export type VenueAusRechercheInput = {
  name: string;
  typ: VenueTyp;
  ort: string;
  website: string | null;
  telefon: string | null;
  notizen: string | null;
  quelle: string;
  veranstaltungsdatum: string | null;
  strasse: string | null;
};

export type VenueAusRechercheResult =
  | { ok: true; venueId: string; bereitsVorhanden: boolean }
  | { ok: false; fehler: string };

// Legt einen Recherche-Treffer als neuen Veranstalter an (ohne Band-Zuordnung,
// die erfolgt anschließend auf der Detailseite). Verhindert Duplikate anhand
// des Namens.
export async function legeVenueAusRechercheAn(
  input: VenueAusRechercheInput
): Promise<VenueAusRechercheResult> {
  const { data: vorhanden } = await supabase
    .from("venues")
    .select("id")
    .ilike("name", input.name)
    .maybeSingle();

  if (vorhanden) {
    return { ok: true, venueId: vorhanden.id, bereitsVorhanden: true };
  }

  const { data: venue, error } = await supabase
    .from("venues")
    .insert({
      name: input.name,
      typ: input.typ,
      ort: input.ort || null,
      website: input.website,
      telefon: input.telefon,
      quelle: input.quelle,
      notizen: input.notizen,
      veranstaltungsdatum: input.veranstaltungsdatum,
      strasse: input.strasse,
    })
    .select("id")
    .single();

  if (error) return { ok: false, fehler: error.message };

  revalidatePath("/");
  revalidatePath("/venues");
  revalidatePath("/pipeline");

  return { ok: true, venueId: venue.id, bereitsVorhanden: false };
}

// Wird vom Kanban-Board beim Drag & Drop aufgerufen, um nur den Status einer
// einzelnen Band<->Venue-Beziehung zu ändern.
export async function updateStatus(
  venueId: string,
  bandId: string,
  status: Status
) {
  const { data: bestehende } = await supabase
    .from("venue_band_status")
    .select("status")
    .eq("venue_id", venueId)
    .eq("band_id", bandId)
    .maybeSingle();

  const statusGeaendert = bestehende?.status !== status;

  const { error } = await supabase
    .from("venue_band_status")
    .update({
      status,
      ...(statusGeaendert
        ? { letzter_kontakt_am: new Date().toISOString() }
        : {}),
    })
    .eq("venue_id", venueId)
    .eq("band_id", bandId);
  if (error) throw new Error(error.message);
  if (statusGeaendert) {
    if (status === "interessiert") {
      await loeseGigAnfrageAus(venueId, bandId);
    } else {
      await schliesseOffeneGigAnfrage(venueId, bandId);
    }
  }

  revalidatePath("/");
  revalidatePath("/venues");
  revalidatePath("/pipeline");
  revalidatePath(`/venues/${venueId}`);
}

// Rückt den Status einer Band<->Venue-Beziehung automatisiert vor (z. B. beim
// Versenden einer E-Mail oder einer eingegangenen Antwort). Rückt nur vor, nie
// zurück, damit ein bereits weiter fortgeschrittener Kontakt nicht versehentlich
// zurückgesetzt wird. `naechsterFollowUpAm` wird nur mitgesetzt, wenn explizit
// übergeben (auch `null`, um den Nachfass-Timer bewusst zu stoppen).
export async function rueckeStatusAutomatischVor(
  venueId: string,
  bandId: string,
  zielStatus: Status,
  naechsterFollowUpAm?: string | null
) {
  const { data: bestehende } = await supabase
    .from("venue_band_status")
    .select("status")
    .eq("venue_id", venueId)
    .eq("band_id", bandId)
    .maybeSingle();

  if (!bestehende) return;
  if (STATUS_ORDER.indexOf(zielStatus) <= STATUS_ORDER.indexOf(bestehende.status)) {
    return;
  }

  const { error } = await supabase
    .from("venue_band_status")
    .update({
      status: zielStatus,
      letzter_kontakt_am: new Date().toISOString(),
      ...(naechsterFollowUpAm !== undefined
        ? { naechster_follow_up_am: naechsterFollowUpAm }
        : {}),
    })
    .eq("venue_id", venueId)
    .eq("band_id", bandId);
  if (error) throw new Error(error.message);
  if (zielStatus === "interessiert") {
    await loeseGigAnfrageAus(venueId, bandId);
  } else {
    await schliesseOffeneGigAnfrage(venueId, bandId);
  }

  revalidatePath("/");
  revalidatePath("/venues");
  revalidatePath("/pipeline");
  revalidatePath(`/venues/${venueId}`);
}

export async function updateBand(bandId: string, formData: FormData) {
  const name = str(formData, "name");
  if (!name) throw new Error("Name ist ein Pflichtfeld.");

  const gagenMin = str(formData, "gagenrahmen_min");
  const gagenMax = str(formData, "gagenrahmen_max");

  const { error } = await supabase
    .from("bands")
    .update({
      name,
      genre: str(formData, "genre"),
      gagenrahmen_min: gagenMin ? Number(gagenMin) : null,
      gagenrahmen_max: gagenMax ? Number(gagenMax) : null,
      kontakt_email: str(formData, "kontakt_email"),
      epk_link: str(formData, "epk_link"),
    })
    .eq("id", bandId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/bands");
  revalidatePath(`/bands/${bandId}`);
  redirect(`/bands/${bandId}?gespeichert=1`);
}

export async function addBandMaterial(
  bandId: string,
  titel: string,
  url: string,
  typ: string
) {
  if (!titel.trim() || !url.trim()) {
    throw new Error("Titel und Link sind Pflichtfelder.");
  }

  const { error } = await supabase.from("band_materialien").insert({
    band_id: bandId,
    titel: titel.trim(),
    url: url.trim(),
    typ: typ.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/bands/${bandId}`);
}

export async function deleteBandMaterial(materialId: string, bandId: string) {
  const { error } = await supabase
    .from("band_materialien")
    .delete()
    .eq("id", materialId);
  if (error) throw new Error(error.message);

  revalidatePath(`/bands/${bandId}`);
}
