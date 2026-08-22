"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  erstelleEinladung,
  erstellePasswortReset,
  loescheNutzer,
  setzeFreigabe,
  widerrufeEinladung,
  type NutzerZeile,
  type OffeneEinladung,
} from "@/lib/nutzerActions";
import {
  BEREICH_LABELS,
  FREIGABE_BEREICHE,
  type FreigabeBereich,
} from "@/lib/freigabenBereiche";

// Admin-Verwaltung der Desktop-Nutzer: Freigabe-Matrix, Einladungs- und
// Passwort-Reset-Links (Einmal-Links, verschickt der Admin selbst), Löschen.
export function NutzerVerwaltung({
  nutzer,
  offeneEinladungen,
}: {
  nutzer: NutzerZeile[];
  offeneEinladungen: OffeneEinladung[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  // Zuletzt erzeugter Link zum Kopieren/Verschicken. Er ist nur hier im
  // Browser sichtbar - neu laden = weg, in der DB liegt nur der Hash.
  const [neuerLink, setNeuerLink] = useState<{
    beschreibung: string;
    url: string;
  } | null>(null);
  const [kopiert, setKopiert] = useState(false);
  // Optimistisch umgeschaltete Häkchen, damit die Matrix sofort reagiert.
  const [lokal, setLokal] = useState<Record<string, boolean>>({});

  const zeigeLink = (beschreibung: string, pfad: string) => {
    setNeuerLink({ beschreibung, url: `${window.location.origin}${pfad}` });
    setKopiert(false);
  };

  const kopiereLink = async () => {
    if (!neuerLink) return;
    await navigator.clipboard.writeText(neuerLink.url);
    setKopiert(true);
  };

  const einladen = () =>
    startTransition(async () => {
      setFehler(null);
      const ergebnis = await erstelleEinladung();
      if (!ergebnis.ok) return setFehler(ergebnis.fehler);
      zeigeLink("Einladungslink (7 Tage gültig, einmal nutzbar)", ergebnis.pfad);
      router.refresh();
    });

  const resetLink = (zeile: NutzerZeile) =>
    startTransition(async () => {
      setFehler(null);
      const ergebnis = await erstellePasswortReset(zeile.user_id);
      if (!ergebnis.ok) return setFehler(ergebnis.fehler);
      zeigeLink(
        `Passwort-Reset-Link für ${zeile.benutzername} (24 Stunden gültig, einmal nutzbar)`,
        ergebnis.pfad
      );
      router.refresh();
    });

  const loeschen = (zeile: NutzerZeile) => {
    if (
      !window.confirm(
        `${zeile.benutzername} wirklich löschen? Der Zugang wird sofort gesperrt. Angelegte Inhalte (Veranstalter, Termine, ...) bleiben erhalten.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      setFehler(null);
      const ergebnis = await loescheNutzer(zeile.user_id);
      if (!ergebnis.ok) return setFehler(ergebnis.fehler);
      router.refresh();
    });
  };

  const widerrufen = (einladung: OffeneEinladung) =>
    startTransition(async () => {
      setFehler(null);
      const ergebnis = await widerrufeEinladung(einladung.id);
      if (!ergebnis.ok) return setFehler(ergebnis.fehler);
      router.refresh();
    });

  const haken = (zeile: NutzerZeile, bereich: FreigabeBereich) =>
    lokal[`${zeile.user_id}:${bereich}`] ?? zeile.bereiche[bereich];

  const umschalten = (zeile: NutzerZeile, bereich: FreigabeBereich) => {
    const neu = !haken(zeile, bereich);
    setLokal((alt) => ({ ...alt, [`${zeile.user_id}:${bereich}`]: neu }));
    startTransition(async () => {
      setFehler(null);
      const ergebnis = await setzeFreigabe(zeile.user_id, bereich, neu);
      if (!ergebnis.ok) {
        setLokal((alt) => ({ ...alt, [`${zeile.user_id}:${bereich}`]: !neu }));
        setFehler(ergebnis.fehler);
      }
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Nutzer &amp; Freigaben
        </h2>
        <button
          type="button"
          onClick={einladen}
          disabled={pending}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          Nutzer einladen
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Jeder Nutzer sieht nur die Bereiche mit Häkchen. Neue Nutzer starten
        ohne Freigaben. Einstellungen bleiben immer Admin-Sache.
      </p>

      {fehler && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {fehler}
        </p>
      )}

      {neuerLink && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">
            {neuerLink.beschreibung}
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-slate-600">
              {neuerLink.url}
            </code>
            <button
              type="button"
              onClick={kopiereLink}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {kopiert ? "Kopiert ✓" : "Kopieren"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Link jetzt verschicken - nach dem Verlassen der Seite ist er hier
            nicht mehr abrufbar (neu erzeugen geht immer).
          </p>
        </div>
      )}

      {nutzer.length === 0 ? (
        <p className="text-sm text-slate-400">
          Noch keine Nutzer. Über „Nutzer einladen“ entsteht ein Einmal-Link,
          den du selbst verschickst.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Benutzername</th>
                {FREIGABE_BEREICHE.map((bereich) => (
                  <th key={bereich} className="px-2 py-2 text-center font-medium">
                    {BEREICH_LABELS[bereich]}
                  </th>
                ))}
                <th className="py-2 pl-3" />
              </tr>
            </thead>
            <tbody>
              {nutzer.map((zeile) => (
                <tr key={zeile.user_id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-900">
                    {zeile.benutzername}
                  </td>
                  {FREIGABE_BEREICHE.map((bereich) => (
                    <td key={bereich} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={haken(zeile, bereich)}
                        onChange={() => umschalten(zeile, bereich)}
                        className="h-4 w-4 accent-slate-900"
                        aria-label={`${BEREICH_LABELS[bereich]} für ${zeile.benutzername}`}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap py-2 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => resetLink(zeile)}
                      disabled={pending}
                      className="mr-3 text-xs font-medium text-slate-500 hover:text-slate-900"
                    >
                      Passwort-Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => loeschen(zeile)}
                      disabled={pending}
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {offeneEinladungen.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-slate-700">
            Offene Links
          </h3>
          <ul className="flex flex-col gap-1">
            {offeneEinladungen.map((einladung) => (
              <li
                key={einladung.id}
                className="flex items-center justify-between gap-3 text-sm text-slate-500"
              >
                <span>
                  {einladung.zweck === "einladung"
                    ? "Einladung"
                    : `Passwort-Reset (${einladung.benutzername ?? "unbekannt"})`}{" "}
                  · gültig bis{" "}
                  {format(new Date(einladung.laeuft_ab), "dd.MM.yyyy HH:mm")}
                </span>
                <button
                  type="button"
                  onClick={() => widerrufen(einladung)}
                  disabled={pending}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Widerrufen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
