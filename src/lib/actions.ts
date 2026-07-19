"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ALLE_BANDS_PARAM, EVENT_TYPEN } from "@/lib/constants";
import { extrahiereStrasse } from "@/lib/adresse";
import { loeseGigAnfrageAus, schliesseOffeneGigAnfrage } from "@/lib/teamActions";
import { setzeStatusVorwaerts } from "@/lib/statusActions";
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
    instagram: str(formData, "instagram"),
    tiktok: str(formData, "tiktok"),
    facebook: str(formData, "facebook"),
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
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  telefon: string | null;
  email: string | null;
  adresse: string | null;
  ort: string | null;
  ansprechpartner: string | null;
  quelleUrl: string | null;
  quelleTitel: string | null;
  impressumUrl: string | null;
  ausschnitt: string | null;
  kiWarnung: string | null;
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

function mitProtokoll(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// Sortiert einen Link-Kandidaten aus den Google-Treffern in Instagram/TikTok/
// Facebook oder "website" (alles andere) ein. Damit landen Social-Media-Profile
// nicht mehr im Website-Feld, wo die Impressum-Suche sonst am falschen Konto
// (Meta/TikTok statt Veranstalter) suchen würde.
function klassifiziereLink(url: string): "instagram" | "tiktok" | "facebook" | "website" | null {
  let host: string;
  try {
    host = new URL(mitProtokoll(url)).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com") {
    return "facebook";
  }
  return "website";
}

// Verhindert, dass die Impressum-Suche (Server-seitiges Fetchen von URLs, die
// letztlich aus einem Nutzer-/Venue-Feld stammen) interne Adressen anfragt.
function istUnsicheresZiel(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  const host = url.hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host)
  );
}

async function fetchMitTimeout(url: string, ms = 6000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VeranstalterAkquiseBot/1.0)" },
    });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Sucht auf der Startseite einer Website nach einem Impressum-/Kontakt-Link.
// Findet sie keinen, werden noch die üblichen Standardpfade direkt probiert.
async function findeImpressumUrl(website: string): Promise<string | null> {
  let basisUrl: URL;
  try {
    basisUrl = new URL(mitProtokoll(website));
  } catch {
    return null;
  }
  if (istUnsicheresZiel(basisUrl)) return null;

  const startseite = await fetchMitTimeout(basisUrl.toString());
  if (startseite) {
    const html = await startseite.text();
    const linkRegex = /<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let kontaktLink: string | null = null;
    let treffer: RegExpExecArray | null;
    while ((treffer = linkRegex.exec(html))) {
      const href = treffer[1];
      const text = treffer[2].replace(/<[^>]+>/g, " ");
      let ziel: URL;
      try {
        ziel = new URL(href, basisUrl);
      } catch {
        continue;
      }
      if (istUnsicheresZiel(ziel)) continue;

      if (/impressum/i.test(href) || /impressum/i.test(text)) {
        return ziel.toString();
      }
      if (!kontaktLink && (/kontakt/i.test(href) || /kontakt/i.test(text))) {
        kontaktLink = ziel.toString();
      }
    }
    if (kontaktLink) return kontaktLink;
  }

  for (const pfad of ["/impressum", "/impressum.html", "/kontakt"]) {
    const kandidat = new URL(pfad, basisUrl);
    if (await fetchMitTimeout(kandidat.toString(), 4000)) {
      return kandidat.toString();
    }
  }

  return null;
}

// Einzelnes Namens-Wort, das an einer Leerzeichen-/Textende-Grenze endet -
// nicht direkt gefolgt von einem Doppelpunkt wie bei "Contact:" im
// unmittelbar folgenden Fließtext. Sonst reißt die Erkennung das nächste
// großgeschriebene Wort mit ins Ergebnis (z. B. "Tom Thomas Contact"). Ein
// einfaches (?!:) direkt hinterm Wort reicht nicht, da der Regex bei
// fehlgeschlagenem Lookahead nur ein Zeichen zurück-backtrackt statt das
// ganze Wort zu verwerfen (Ergebnis wäre "Contac" statt gar nichts).
const NAME_WORT = "[A-ZÀ-Þ][A-Za-zÀ-ÿ.'-]*(?=\\s|$)";
const NAME_MUSTER = `${NAME_WORT}(?:\\s+${NAME_WORT}){1,3}`;
const ANSPRECHPARTNER_MUSTER = [
  // Deutsch
  new RegExp(`Vertreten durch:?\\s*(${NAME_MUSTER})`),
  new RegExp(`Geschäftsführer(?:in)?:?\\s*(${NAME_MUSTER})`),
  new RegExp(`Inhaber(?:in)?:?\\s*(${NAME_MUSTER})`),
  new RegExp(`Ansprechpartner(?:in)?:?\\s*(${NAME_MUSTER})`),
  // Englisch - manche Clubs/Festivals mit internationalem Publikum haben ihr
  // Impressum nur auf Englisch.
  new RegExp(`Represented by:?\\s*(${NAME_MUSTER})`, "i"),
  new RegExp(`Managing Directors?:?\\s*(${NAME_MUSTER})`, "i"),
  new RegExp(`Owner:?\\s*(${NAME_MUSTER})`, "i"),
  new RegExp(`Contact person:?\\s*(${NAME_MUSTER})`, "i"),
];

// Cloudflares "E-Mail-Verschleierung" (Spam-Schutz) ersetzt mailto-Links durch
// einen XOR-verschlüsselten Hex-String (data-cfemail="..."), der erst per
// JavaScript im Browser entschlüsselt wird - im rohen HTML ist die Adresse
// sonst unsichtbar. Der Algorithmus ist öffentlich dokumentiert und simpel:
// erstes Byte ist der Schlüssel, alle weiteren Bytes XOR-verknüpft damit.
function entschluessleCfEmail(hex: string): string | null {
  if (hex.length < 4 || hex.length % 2 !== 0) return null;
  const schluessel = parseInt(hex.slice(0, 2), 16);
  if (Number.isNaN(schluessel)) return null;
  let ergebnis = "";
  for (let i = 2; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return null;
    ergebnis += String.fromCharCode(byte ^ schluessel);
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ergebnis) ? ergebnis : null;
}

type ImpressumDaten = {
  email: string | null;
  telefon: string | null;
  ansprechpartner: string | null;
  strasse: string | null;
  ort: string | null;
  textAusschnitt: string;
};

// Wertet den HTML-Text einer Impressum-/Kontaktseite aus. Impressen sind in
// Deutschland gesetzlich vorgeschrieben und enthalten daher meist zuverlässig
// Name, Adresse, Telefon und E-Mail - ergiebiger als eine Google-Trefferliste.
function extrahiereAusImpressum(html: string): ImpressumDaten {
  const mailtoTreffer = html.match(/href=["']mailto:([^"'?]+)/i);
  const telTreffer = html.match(/href=["']tel:([^"']+)/i);
  const cfEmailTreffer = html.match(/data-cfemail=["']([0-9a-f]+)["']/i);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const cfEmail = cfEmailTreffer ? entschluessleCfEmail(cfEmailTreffer[1]) : null;
  const email = mailtoTreffer?.[1]?.trim() || cfEmail || extrahiereEmailAusText(text);
  const telefonRoh = telTreffer?.[1]?.replace(/[^+\d]/g, "").trim();
  const telefon = telefonRoh || extrahiereTelefonAusText(text);

  let ansprechpartner: string | null = null;
  for (const muster of ANSPRECHPARTNER_MUSTER) {
    const treffer = text.match(muster);
    if (treffer?.[1]) {
      ansprechpartner = treffer[1].trim();
      break;
    }
  }

  const strasse = extrahiereStrasse(text);
  const ortTreffer = text.match(
    /\b\d{5}\s+([A-ZÀ-Þ][A-Za-zÀ-ÿ-]+(?:\s[A-ZÀ-Þ][A-Za-zÀ-ÿ-]+)*)\b/
  );
  const ort = ortTreffer?.[1]?.trim() ?? null;

  return { email, telefon, ansprechpartner, strasse, ort, textAusschnitt: text.slice(0, 1500) };
}

// Lässt Claude (Haiku, günstig/schnell) einmal draufschauen, ob die
// gefundene Seite überhaupt zum gesuchten Veranstalter gehört - erkennt z. B.
// Aggregator-/Ticket-/Stadt-App-Seiten, die zwar den Termin listen, aber
// nicht vom Veranstalter selbst betrieben werden (deren Impressum würde dann
// falsche Kontaktdaten liefern). Rein additiv: liefert nur eine Warnung dazu,
// verändert die gefundenen Felder nicht. Bei fehlendem API-Key oder Fehlern
// wird die Prüfung übersprungen, statt die eigentliche Recherche zu stören.
async function pruefePlausibilitaet(
  name: string,
  ort: string | null,
  website: string | null,
  daten: KontaktRechercheErgebnis,
  impressumText: string | null
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !website) return null;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const kontext = [
      `Gesuchter Veranstalter: "${name}"${ort ? ` (Ort: ${ort})` : ""}`,
      `Gefundene Website: ${website}`,
      daten.quelleTitel ? `Titel des Google-Treffers: "${daten.quelleTitel}"` : null,
      daten.ausschnitt ? `Google-Textausschnitt: "${daten.ausschnitt}"` : null,
      impressumText ? `Text von der Impressum-/Kontaktseite: "${impressumText}"` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const antwort = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system:
        "Du prüfst, ob eine gefundene Website vom gesuchten Veranstalter selbst " +
        "betrieben wird, oder ob es eine fremde Seite ist, die den Termin nur " +
        "auflistet (z. B. Ticketportal, Stadt-/Tourismus-App, Presseartikel, " +
        "Veranstaltungskalender). Antworte AUSSCHLIESSLICH mit dem reinen " +
        "JSON-Objekt, ohne Markdown-Codeblock (keine ```), ohne Erklärung " +
        "davor oder danach: {\"plausibel\": true oder false, \"grund\": " +
        "\"ein kurzer deutscher Satz\"}.",
      messages: [{ role: "user", content: kontext }],
    });

    const block = antwort.content[0];
    if (block.type !== "text") return null;
    // Trotz Anweisung verpackt das Modell die Antwort gelegentlich in einen
    // Markdown-Codeblock (```json ... ```) - vor dem Parsen entfernen.
    const rohtext = block.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const json = JSON.parse(rohtext) as { plausibel: boolean; grund: string };
    if (json.plausibel) return null;
    return json.grund || "Die gefundene Seite scheint nicht vom Veranstalter selbst zu sein.";
  } catch {
    return null;
  }
}

// Sucht per SerpApi (Google-Suche) nach Kontaktdaten für einen Veranstalter
// und ergänzt anschließend, sofern eine Website bekannt ist, alles, was aus
// deren Impressum/Kontaktseite zusätzlich herauszuholen ist (inkl.
// Ansprechpartner, den die Google-Suche allein nicht liefert). Füllt am Ende
// nur, was noch leer ist - die Google-Treffer haben Vorrang.
export async function rechercheKontakt(
  name: string,
  ort: string | null,
  bekannteWebsite?: string | null
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

  // Scannt alle Link-Kandidaten aus demselben Suchaufruf (kein zusätzlicher
  // API-Call): der erste "echte" Domain-Treffer wird Website, Instagram/
  // TikTok/Facebook-Links werden separat erkannt statt die Website zu
  // überschreiben.
  const linkKandidaten: string[] = [
    place?.links?.website,
    place?.website,
    kg?.website,
    ...(Array.isArray(json.organic_results)
      ? json.organic_results.map((r: { link?: string }) => r.link)
      : []),
  ].filter((wert): wert is string => Boolean(wert));

  let website: string | null = null;
  let instagram: string | null = null;
  let tiktok: string | null = null;
  let facebook: string | null = null;
  for (const kandidat of linkKandidaten) {
    const kategorie = klassifiziereLink(kandidat);
    if (kategorie === "instagram" && !instagram) instagram = kandidat;
    else if (kategorie === "tiktok" && !tiktok) tiktok = kandidat;
    else if (kategorie === "facebook" && !facebook) facebook = kandidat;
    else if (kategorie === "website" && !website) website = kandidat;
  }

  const daten: KontaktRechercheErgebnis = {
    website,
    instagram,
    tiktok,
    facebook,
    telefon: place?.phone ?? kg?.phone ?? extrahiereTelefonAusText(ausschnitt),
    email: extrahiereEmailAusText(ausschnitt),
    adresse:
      extrahiereStrasse(place?.address ?? kg?.address ?? null) ??
      extrahiereStrasse(ausschnitt),
    ort: null,
    ansprechpartner: null,
    quelleUrl: erster?.link ?? place?.links?.website ?? null,
    quelleTitel: erster?.title ?? place?.title ?? null,
    impressumUrl: null,
    ausschnitt,
    kiWarnung: null,
  };

  let impressumText: string | null = null;
  const websiteFuerImpressum = daten.website ?? bekannteWebsite ?? null;
  if (websiteFuerImpressum) {
    try {
      const impressumLink = await findeImpressumUrl(websiteFuerImpressum);
      if (impressumLink) {
        const seite = await fetchMitTimeout(impressumLink);
        if (seite) {
          const impressum = extrahiereAusImpressum(await seite.text());
          daten.impressumUrl = impressumLink;
          daten.ansprechpartner = impressum.ansprechpartner;
          if (!daten.email) daten.email = impressum.email;
          if (!daten.telefon) daten.telefon = impressum.telefon;
          if (!daten.adresse) daten.adresse = impressum.strasse;
          daten.ort = impressum.ort;
          impressumText = impressum.textAusschnitt;
        }
      }
    } catch {
      // Impressum-Anreicherung ist optional - Fehler dort dürfen die
      // eigentliche (Google-basierte) Recherche nicht scheitern lassen.
    }
  }

  daten.kiWarnung = await pruefePlausibilitaet(
    name,
    ort,
    websiteFuerImpressum,
    daten,
    impressumText
  );

  const nichtsGefunden =
    !daten.website &&
    !daten.telefon &&
    !daten.email &&
    !daten.adresse &&
    !daten.ansprechpartner &&
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
  // Separat von "datum" (Anzeige-Text wie "Heute, 12:00–23:59 Uhr" oder "Sa,
  // 12:00–22:00 Uhr" - bei nahen Terminen oft ohne Tag/Monat, damit für die
  // automatische Datums-Erkennung unbrauchbar). Google Events liefert
  // zusätzlich date.start_date (z. B. "Jul 25"), das zuverlässig ein
  // erkennbares Datum enthält.
  datumStart: string | null;
  beschreibung: string | null;
  quelleEngine: "events" | "maps" | "web";
};

export type VeranstalterSucheResult =
  | { ok: true; treffer: RechercheTreffer[]; hinweis?: string }
  | { ok: false; fehler: string; leer?: boolean };

// Festival/Stadtfest sind wiederkehrende, datierte Veranstaltungen -> Google
// Events (mit Termin). Club/Firmenevent/Hochzeit/Sonstiges sind feste
// Locations -> Google Maps (mit Adresse/Kategorie, aber ohne Termin).
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
      datum: r.date?.when ?? null,
      datumStart: r.date?.start_date ?? null,
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
      datumStart: null,
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
      datumStart: null,
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
  bandFilter: string;
};

export type VenueAusRechercheResult =
  | { ok: true; venueId: string; bereitsVorhanden: boolean }
  | { ok: false; fehler: string };

// Verknüpft einen Veranstalter mit Status "neu" mit der Band, die beim
// Anlegen aus der Suche gerade im Band-Umschalter ausgewählt war - damit er
// sofort in der Pipeline auftaucht, statt erst nach manueller Zuordnung auf
// der Detailseite. Bei "Beide" ausgewählt wird bewusst nicht automatisch mit
// beiden Bands verknüpft (das wäre eine Vorfestlegung, die der Nutzer selbst
// auf der Detailseite treffen soll) - die Zuordnung bleibt dann komplett
// manuell. Bestehende Zuordnungen werden nicht überschrieben (z. B. bei einem
// schon vorhandenen Treffer).
async function verknuepfeMitAktuellemBand(venueId: string, bandFilter: string) {
  if (bandFilter === ALLE_BANDS_PARAM) return;
  const bandIds = [bandFilter];

  for (const bandId of bandIds) {
    const { data: bestehende } = await supabase
      .from("venue_band_status")
      .select("id")
      .eq("venue_id", venueId)
      .eq("band_id", bandId)
      .maybeSingle();
    if (bestehende) continue;

    await supabase.from("venue_band_status").insert({
      venue_id: venueId,
      band_id: bandId,
      status: "neu",
    });
  }
}

// Legt einen Recherche-Treffer als neuen Veranstalter an und verknüpft ihn
// direkt mit dem/den aktuell ausgewählten Band(s), damit er sofort in der
// Pipeline sichtbar ist. Verhindert Duplikate anhand des Namens.
export async function legeVenueAusRechercheAn(
  input: VenueAusRechercheInput
): Promise<VenueAusRechercheResult> {
  const { data: vorhanden } = await supabase
    .from("venues")
    .select("id")
    .ilike("name", input.name)
    .maybeSingle();

  let venueId: string;
  let bereitsVorhanden: boolean;

  if (vorhanden) {
    venueId = vorhanden.id;
    bereitsVorhanden = true;
  } else {
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
    venueId = venue.id;
    bereitsVorhanden = false;
  }

  await verknuepfeMitAktuellemBand(venueId, input.bandFilter);

  revalidatePath("/");
  revalidatePath("/venues");
  revalidatePath("/pipeline");

  return { ok: true, venueId, bereitsVorhanden };
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
  const geaendert = await setzeStatusVorwaerts(
    venueId,
    bandId,
    zielStatus,
    naechsterFollowUpAm
  );
  if (!geaendert) return;

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
  revalidatePath("/einstellungen");
  revalidatePath(`/einstellungen/${bandId}`);
  redirect(`/einstellungen/${bandId}?gespeichert=1`);
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

  revalidatePath(`/einstellungen/${bandId}`);
}

export async function deleteBandMaterial(materialId: string, bandId: string) {
  const { error } = await supabase
    .from("band_materialien")
    .delete()
    .eq("id", materialId);
  if (error) throw new Error(error.message);

  revalidatePath(`/einstellungen/${bandId}`);
}
