"use client";

import { useState } from "react";
import type { Venue } from "@/lib/types";
import type { SetlisteMitSongs } from "@/lib/queries";
import { berechneSetZeiten } from "@/lib/setzeiten";

function normalizeTelefon(telefon: string) {
  return telefon.replace(/[^+\d]/g, "");
}

function formatDatum(datum: string | null): string {
  if (!datum) return "";
  return datum.split("-").reverse().join(".");
}

function formatZeit(zeit: string | null): string {
  return zeit ? zeit.slice(0, 5) : "";
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100">
        {wert}
      </span>
    </div>
  );
}

// Detail-Ansicht für einen gebuchten Auftritt in der Team-App - zeigt die auf
// der Veranstalterkarte hinterlegten Gig-Infos (ohne Gage/Konditionen).
export function GigInfoModal({
  venue,
  setliste,
  onClose,
}: {
  venue: Venue;
  setliste?: SetlisteMitSongs | null;
  onClose: () => void;
}) {
  const setZeiten = setliste
    ? berechneSetZeiten(venue.gig_beginn, setliste.songs, setliste.pausen ?? [])
    : null;
  const zeiten = [
    venue.gig_treffen_proberaum &&
      `Treffen Proberaum ${formatZeit(venue.gig_treffen_proberaum)}`,
    venue.gig_soundcheck && `Soundcheck ${formatZeit(venue.gig_soundcheck)}`,
    venue.gig_einlass && `Einlass ${formatZeit(venue.gig_einlass)}`,
    venue.gig_beginn && `Beginn ${formatZeit(venue.gig_beginn)}`,
    venue.gig_ende && `Ende ${formatZeit(venue.gig_ende)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Bevorzugt die Liste (mehrere Ansprechpartner); fällt auf die Alt-
  // Einzelfelder (Migration 0021) zurück, solange die noch nicht migriert sind.
  const kontakte =
    venue.gig_ansprechpartner && venue.gig_ansprechpartner.length > 0
      ? venue.gig_ansprechpartner
      : venue.gig_kontakt_name || venue.gig_kontakt_telefon
        ? [
            {
              rolle: "",
              name: venue.gig_kontakt_name ?? "",
              telefon: venue.gig_kontakt_telefon ?? "",
            },
          ]
        : [];

  const adresse = [venue.strasse, venue.ort]
    .map((t) => t?.trim())
    .filter(Boolean)
    .join(", ");
  // Für die Navigation zusätzlich den Namen mitgeben - hilft, wenn keine
  // Straße hinterlegt ist oder die Adresse ungenau ist.
  const naviZiel = encodeURIComponent(
    [venue.name, venue.strasse, venue.ort].map((t) => t?.trim()).filter(Boolean).join(", ")
  );
  const [kopiert, setKopiert] = useState(false);
  async function kopiereAdresse() {
    try {
      await navigator.clipboard.writeText(adresse);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1500);
    } catch {
      // Clipboard nicht verfügbar (z. B. ohne HTTPS) - dann bleibt der Text
      // wenigstens sichtbar zum manuellen Markieren.
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-4 shadow-lg dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {venue.name}
            </h3>
            {venue.veranstaltungsdatum && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDatum(venue.veranstaltungsdatum)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {adresse && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Adresse
              </span>
              <span className="text-sm text-slate-900 dark:text-slate-100">
                {adresse}
              </span>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
                <button
                  type="button"
                  onClick={kopiereAdresse}
                  className="text-slate-600 underline dark:text-slate-300"
                >
                  {kopiert ? "Kopiert ✓" : "Kopieren"}
                </button>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${naviZiel}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 underline dark:text-slate-300"
                >
                  Google Maps ↗
                </a>
                <a
                  href={`https://maps.apple.com/?daddr=${naviZiel}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 underline dark:text-slate-300"
                >
                  Apple Karten ↗
                </a>
              </div>
            </div>
          )}
          {zeiten && <Zeile label="Zeiten" wert={zeiten} />}
          {venue.gig_zeiten_notiz && (
            <Zeile label="Weitere Zeiten" wert={venue.gig_zeiten_notiz} />
          )}
          {venue.gig_logistik && (
            <Zeile label="Logistik vor Ort" wert={venue.gig_logistik} />
          )}
          {setliste && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Setliste
              </span>
              <span className="text-sm text-slate-900 dark:text-slate-100">
                {setliste.name}
              </span>
              {setZeiten ? (
                <ul className="mt-1 flex flex-col gap-0.5 text-sm text-slate-700 dark:text-slate-300">
                  {setZeiten.sets.map((s) => (
                    <li key={s.nummer}>
                      Set {s.nummer}: {s.start}–{s.ende}
                      {s.pauseDanachMin ? ` · Pause ${s.pauseDanachMin} min` : ""}
                    </li>
                  ))}
                  <li className="font-medium">Ende {setZeiten.ende}</li>
                </ul>
              ) : (
                <span className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  {setliste.songs.length} Songs
                </span>
              )}
            </div>
          )}
          {kontakte.length > 0 && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Ansprechpartner vor Ort
              </span>
              <div className="mt-1 flex flex-col gap-1.5">
                {kontakte.map((partner, index) => (
                  <div key={index} className="text-sm">
                    <span className="text-slate-900 dark:text-slate-100">
                      {[partner.rolle, partner.name].filter(Boolean).join(": ") ||
                        "Kontakt"}
                    </span>
                    {partner.telefon && (
                      <a
                        href={`tel:${normalizeTelefon(partner.telefon)}`}
                        className="ml-2 font-medium text-slate-600 underline dark:text-slate-300"
                      >
                        {partner.telefon} · Anrufen ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!adresse &&
            !zeiten &&
            !venue.gig_zeiten_notiz &&
            !venue.gig_logistik &&
            !setliste &&
            kontakte.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Noch keine Auftritts-Infos hinterlegt.
              </p>
            )}
        </div>
      </div>
    </div>
  );
}
