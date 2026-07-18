"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  legeVenueAusRechercheAn,
  sucheVeranstalter,
  type RechercheTreffer,
} from "@/lib/actions";
import { VENUE_TYPEN } from "@/lib/constants";
import { extrahiereVeranstaltungsdatum } from "@/lib/datum";
import { extrahiereStrasse } from "@/lib/adresse";
import type { VenueTyp } from "@/lib/database.types";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none";

type AnlegenStatus = {
  laeuft: boolean;
  venueId: string | null;
  bereitsVorhanden: boolean;
  fehler: string | null;
};

// Letzte Suche wird im Browser gespeichert (nicht in der DB - rein lokaler
// UI-Zustand), damit sie beim erneuten Öffnen der Seite automatisch wieder da
// ist. Spart wiederholte SerpApi-Aufrufe (begrenztes Monats-Kontingent).
const STORAGE_KEY = "veranstalter-akquise:letzte-suche";

type GespeicherteSuche = {
  typ: VenueTyp | "";
  ort: string;
  zusatz: string;
  treffer: RechercheTreffer[];
  hinweis: string | null;
  trefferTyp: Record<number, VenueTyp>;
  status: Record<number, AnlegenStatus>;
};

function ladeGespeicherteSuche(): GespeicherteSuche | null {
  if (typeof window === "undefined") return null;
  try {
    const roh = window.localStorage.getItem(STORAGE_KEY);
    return roh ? (JSON.parse(roh) as GespeicherteSuche) : null;
  } catch {
    return null;
  }
}

const QUELLE_LABEL: Record<RechercheTreffer["quelleEngine"], string> = {
  events: "SerpApi Recherche (Google Events)",
  maps: "SerpApi Recherche (Google Maps)",
  web: "SerpApi Recherche (Websuche)",
};

// Schätzt nach dem Suchen eine plausible Kategorie, wenn kein Typ vorher
// festgelegt wurde - der Nutzer kann sie pro Treffer noch anpassen, bevor
// der Veranstalter angelegt wird.
function typVorschlag(treffer: RechercheTreffer, suchbegriffe: string): VenueTyp {
  const text = suchbegriffe.toLowerCase();

  if (treffer.quelleEngine === "maps") {
    const kategorie = (treffer.typen ?? "").toLowerCase();
    if (/nachtclub|diskothek|bar\b|kneipe|lounge/.test(kategorie)) return "Club";
    if (/hochzeit/.test(kategorie)) return "Hochzeit";
    if (/tagung|konferenz|firmen/.test(kategorie)) return "Firmenevent";
    if (/festival/.test(kategorie)) return "Festival";
    if (/stadtfest/.test(kategorie)) return "Stadtfest";
    return "Sonstiges";
  }

  // Events- oder Web-Treffer: meist Festival/Stadtfest-artig, da diese Pfade
  // primär für Veranstaltungssuchen ohne festen Typ greifen.
  if (/stadtfest/.test(text)) return "Stadtfest";
  if (/festival/.test(text)) return "Festival";
  return treffer.quelleEngine === "events" ? "Festival" : "Sonstiges";
}

export function VenueSucheForm({ bandFilter }: { bandFilter: string }) {
  const [typ, setTyp] = useState<VenueTyp | "">(
    () => ladeGespeicherteSuche()?.typ ?? ""
  );
  const [ort, setOrt] = useState(() => ladeGespeicherteSuche()?.ort ?? "");
  const [zusatz, setZusatz] = useState(
    () => ladeGespeicherteSuche()?.zusatz ?? ""
  );

  const [suche, setSuche] = useState<{
    laeuft: boolean;
    fehler: string | null;
    hinweis: string | null;
    treffer: RechercheTreffer[];
  }>(() => {
    const gespeichert = ladeGespeicherteSuche();
    return {
      laeuft: false,
      fehler: null,
      hinweis: gespeichert?.hinweis ?? null,
      treffer: gespeichert?.treffer ?? [],
    };
  });

  const [trefferTyp, setTrefferTyp] = useState<Record<number, VenueTyp>>(
    () => ladeGespeicherteSuche()?.trefferTyp ?? {}
  );
  const [status, setStatus] = useState<Record<number, AnlegenStatus>>(
    () => ladeGespeicherteSuche()?.status ?? {}
  );

  // Speichert die aktuelle Suche (Kriterien + Treffer + Anlegen-Status) bei
  // jeder Änderung im Browser, damit sie beim nächsten Aufruf der Seite
  // automatisch wiederhergestellt wird.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (suche.treffer.length === 0) return;

    const gespeichert: GespeicherteSuche = {
      typ,
      ort,
      zusatz,
      treffer: suche.treffer,
      hinweis: suche.hinweis,
      trefferTyp,
      status,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gespeichert));
  }, [typ, ort, zusatz, suche.treffer, suche.hinweis, trefferTyp, status]);

  async function handleSuche(e: React.FormEvent) {
    e.preventDefault();
    setSuche({ laeuft: true, fehler: null, hinweis: null, treffer: [] });
    setStatus({});
    setTrefferTyp({});

    const ergebnis = await sucheVeranstalter(typ, ort, zusatz);

    if (!ergebnis.ok) {
      setSuche({ laeuft: false, fehler: ergebnis.fehler, hinweis: null, treffer: [] });
      return;
    }

    if (!typ) {
      const vorschlaege: Record<number, VenueTyp> = {};
      ergebnis.treffer.forEach((t, i) => {
        vorschlaege[i] = typVorschlag(t, zusatz);
      });
      setTrefferTyp(vorschlaege);
    }

    setSuche({
      laeuft: false,
      fehler: null,
      hinweis: ergebnis.hinweis ?? null,
      treffer: ergebnis.treffer,
    });
  }

  async function handleAnlegen(index: number, treffer: RechercheTreffer) {
    setStatus((prev) => ({
      ...prev,
      [index]: { laeuft: true, venueId: null, bereitsVorhanden: false, fehler: null },
    }));

    // Straße/Hausnummer wird aus treffer.adresse extrahiert und geht direkt
    // ins eigene Feld - der volle Adresstext kommt nur in die Notizen, wenn
    // sich daraus keine Straße erkennen ließ (sonst wäre er redundant).
    const strasse = extrahiereStrasse(treffer.adresse);

    const notizen =
      [
        treffer.typen
          ? treffer.quelleEngine === "events"
            ? `Venue laut Google: ${treffer.typen}`
            : `Kategorie (Google Maps): ${treffer.typen}`
          : null,
        treffer.adresse && !strasse ? `Adresse: ${treffer.adresse}` : null,
        treffer.rating
          ? `Bewertung: ${treffer.rating} (${treffer.reviews ?? 0} Rezensionen)`
          : null,
        treffer.beschreibung ? `Ausschnitt: "${treffer.beschreibung}"` : null,
      ]
        .filter(Boolean)
        .join("\n") || null;

    const ergebnis = await legeVenueAusRechercheAn({
      name: treffer.title,
      typ: typ || trefferTyp[index] || "Sonstiges",
      ort,
      website: treffer.website,
      telefon: treffer.telefon,
      notizen,
      quelle: QUELLE_LABEL[treffer.quelleEngine],
      strasse,
      bandFilter,
      // treffer.datum ist bei der Websuche-Quelle immer leer (kein
      // strukturiertes Feld) - als Fallback wird der Beschreibungstext
      // durchsucht, der das Datum oft als Freitext enthält (z. B. "Langenfeld
      // live - Vom 8. Juli bis zum 2. September ..."). Das "nächstes Jahr,
      // falls vergangen"-Vorrücken gilt nur für treffer.datum (verlässliche
      // Google-Events-Quelle, zeigt nur kommende Termine) - der Freitext kann
      // auch eine bereits laufende Saison beschreiben.
      veranstaltungsdatum:
        extrahiereVeranstaltungsdatum(treffer.datum, {
          naechstesJahrWennVergangen: true,
        }) ?? extrahiereVeranstaltungsdatum(treffer.beschreibung),
    });

    if (!ergebnis.ok) {
      setStatus((prev) => ({
        ...prev,
        [index]: {
          laeuft: false,
          venueId: null,
          bereitsVorhanden: false,
          fehler: ergebnis.fehler,
        },
      }));
      return;
    }

    setStatus((prev) => ({
      ...prev,
      [index]: {
        laeuft: false,
        venueId: ergebnis.venueId,
        bereitsVorhanden: ergebnis.bereitsVorhanden,
        fehler: null,
      },
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSuche}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Typ</span>
          <select
            value={typ}
            onChange={(e) => setTyp(e.target.value as VenueTyp | "")}
            className={inputClass}
          >
            <option value="">Alle Typen (nach Suche festlegen)</option>
            {VENUE_TYPEN.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Ort/Region *</span>
          <input
            required
            value={ort}
            onChange={(e) => setOrt(e.target.value)}
            placeholder="z. B. Köln"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">
            Zusätzliche Suchbegriffe
          </span>
          <input
            value={zusatz}
            onChange={(e) => setZusatz(e.target.value)}
            placeholder="z. B. Meine Stadt Live"
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={suche.laeuft}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {suche.laeuft ? "Suche läuft…" : "Suchen"}
        </button>
      </form>

      {suche.fehler && <p className="text-sm text-red-600">{suche.fehler}</p>}
      {suche.hinweis && (
        <p className="text-sm text-amber-700">{suche.hinweis}</p>
      )}

      <div className="flex flex-col gap-3">
        {suche.treffer.map((treffer, index) => {
          const s = status[index];
          return (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{treffer.title}</p>
                {treffer.datum && (
                  <p className="text-sm font-medium text-indigo-700">
                    📅 {treffer.datum}
                  </p>
                )}
                {treffer.typen && (
                  <p className="text-xs text-slate-500">
                    {treffer.quelleEngine === "events"
                      ? `Venue: ${treffer.typen}`
                      : treffer.typen}
                  </p>
                )}
                {treffer.adresse && (
                  <p className="text-sm text-slate-600">{treffer.adresse}</p>
                )}
                {treffer.beschreibung && (
                  <p className="mt-1 max-w-md text-xs text-slate-500 italic">
                    „{treffer.beschreibung}“
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                  {treffer.rating != null && (
                    <span>
                      ★ {treffer.rating} ({treffer.reviews ?? 0})
                    </span>
                  )}
                  {treffer.telefon && <span>{treffer.telefon}</span>}
                  {treffer.website && (
                    <a
                      href={treffer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Website
                    </a>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {!typ && !s?.venueId && (
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    Typ:
                    <select
                      value={trefferTyp[index] ?? "Sonstiges"}
                      onChange={(e) =>
                        setTrefferTyp((prev) => ({
                          ...prev,
                          [index]: e.target.value as VenueTyp,
                        }))
                      }
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      {VENUE_TYPEN.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {s?.venueId ? (
                  <Link
                    href={`/venues/${s.venueId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-green-700 underline"
                  >
                    {s.bereitsVorhanden
                      ? "Bereits vorhanden – öffnen ↗"
                      : "✓ Angelegt – öffnen ↗"}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={s?.laeuft}
                    onClick={() => handleAnlegen(index, treffer)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {s?.laeuft ? "Wird angelegt…" : "Als Veranstalter anlegen"}
                  </button>
                )}
                {s?.fehler && <p className="mt-1 text-xs text-red-600">{s.fehler}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
