"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  registriereMitglied,
  aktualisierePushSubscription,
  holeOffeneAnfragen,
  beantworteAnfrage,
  beantworteTermin,
  holeTerminAntworten,
  type PushSubscriptionInput,
} from "@/lib/teamActions";
import { berechneTeilnahme, kalenderPillFarbe, kommendeVorkommen } from "@/lib/kalenderHelpers";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import { SetlisteBuilder } from "@/components/SetlisteBuilder";
import { ProduktionListe } from "@/components/ProduktionListe";
import { KalenderMonatsView } from "@/components/KalenderMonatsView";
import { KalenderJahresView } from "@/components/KalenderJahresView";
import { TermineManager } from "@/components/TermineManager";
import { TerminTeilnahmeUebersicht } from "@/components/TerminTeilnahmeUebersicht";
import type {
  BandSong,
  KalenderTermin,
  OffeneAnfrageFuerMitglied,
  PipelineEntry,
  Produktion,
  TerminTeilnahme,
} from "@/lib/types";
import type { SetlisteMitSongs } from "@/lib/queries";
import type { ProberaumTermin } from "@/lib/proberaumKalender";

type TeamTab = "dashboard" | "kalender" | "setliste" | "produktion";

function heuteAlsIsoDatum(): string {
  const heute = new Date();
  const jj = heute.getFullYear();
  const mm = String(heute.getMonth() + 1).padStart(2, "0");
  const tt = String(heute.getDate()).padStart(2, "0");
  return `${jj}-${mm}-${tt}`;
}

function tabLink(tab: TeamTab) {
  return `?tab=${tab}`;
}

const WOCHENTAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// "Di, 15.07.2026" aus "2026-07-15" (lokale Datumsfelder, kein UTC-Parsing).
function formatTerminDatum(datum: string): string {
  const [jj, mm, tt] = datum.split("-").map(Number);
  const wochentag = WOCHENTAGE_KURZ[new Date(jj, mm - 1, tt).getDay()];
  return `${wochentag}, ${String(tt).padStart(2, "0")}.${String(mm).padStart(2, "0")}.${jj}`;
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9.5h16M8 3v3M16 3v3" />
    </svg>
  );
}

function SetlisteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M9 17V5l10-2v12" />
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="16" cy="15" r="2.5" />
    </svg>
  );
}

function ProduktionIcon() {
  // Schieberegler/Fader - Anspielung auf Mixing/Produktion.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M6 3v6M6 15v6M12 3v10M12 19v2M18 3v2M18 11v10" />
      <path d="M4 11h4M10 15h4M16 7h4" />
    </svg>
  );
}

function MondIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" />
    </svg>
  );
}

function SonneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

const STORAGE_PREFIX = "team-mitglied:";
const DUNKEL_PREFIX = "team-dunkelmodus:";

type Identitaet = { mitgliedId: string; name: string };

function ladeIdentitaet(bandId: string): Identitaet | null {
  if (typeof window === "undefined") return null;
  try {
    const roh = window.localStorage.getItem(STORAGE_PREFIX + bandId);
    return roh ? (JSON.parse(roh) as Identitaet) : null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function subscriptionZuInput(sub: PushSubscription): PushSubscriptionInput {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

// iOS bietet die Push-API nur an, wenn die Seite über "Zum Home-Bildschirm
// hinzufügen" installiert und von dort geöffnet wurde (ab iOS 16.4) - in
// einem normalen Safari-Tab fehlt window.PushManager komplett. Das ist eine
// bewusste Apple-Einschränkung, keine fehlende Funktion hier.
function istIosOhneHomescreen(): boolean {
  const istIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const istStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return istIOS && !istStandalone;
}

// Fordert Push-Erlaubnis an und meldet den Service Worker an. Gibt null
// zurück, wenn der Browser Push nicht unterstützt oder die Person ablehnt -
// die App bleibt dann trotzdem manuell nutzbar.
async function versuchePushSubscription(): Promise<{
  subscription: PushSubscriptionInput | null;
  hinweis: string | null;
}> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      subscription: null,
      hinweis: istIosOhneHomescreen()
        ? "Für Push-Benachrichtigungen diese Seite in Safari über das Teilen-Symbol zu 'Zum Home-Bildschirm' hinzufügen und von dort öffnen (ab iOS 16.4)."
        : "Push-Benachrichtigungen werden auf diesem Gerät/Browser nicht unterstützt.",
    };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { subscription: null, hinweis: null };
  }

  try {
    const registration = await navigator.serviceWorker.register("/team-sw.js");

    // Bereits erteilte/verweigerte Erlaubnis nicht erneut per
    // requestPermission() abfragen: iOS Safari beantwortet diesen Aufruf
    // außerhalb einer direkten Nutzer-Geste (z. B. beim automatischen Laden
    // der Seite) nicht zuverlässig mit dem tatsächlichen Status, selbst wenn
    // in den iPhone-Einstellungen längst "Erlaubt" steht. Notification.permission
    // ist dagegen ein synchroner, zuverlässiger Blick auf den echten Zustand -
    // nur bei "default" (noch nie entschieden) wird wirklich nachgefragt.
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      return {
        subscription: null,
        hinweis:
          "Benachrichtigungen sind deaktiviert. Ohne sie bekommst du keine Push-Nachricht, kannst die Seite aber weiter manuell öffnen.",
      };
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
    return { subscription: subscriptionZuInput(subscription), hinweis: null };
  } catch (err) {
    console.error("Push-Registrierung fehlgeschlagen", err);
    return {
      subscription: null,
      hinweis:
        "Push-Benachrichtigungen konnten nicht aktiviert werden. Öffne die Seite gelegentlich manuell, um neue Anfragen zu sehen.",
    };
  }
}

export function TeamApp({
  bandId,
  bandName,
  logoUrl,
  kalenderEintraege,
  songs,
  setlisten,
  produktionen,
  aktiverTab,
  kalenderAnsicht,
  monatParam,
  jahrParam,
  proberaumTermine,
  termine,
  terminTeilnahme,
}: {
  bandId: string;
  bandName: string;
  logoUrl: string | null;
  kalenderEintraege: PipelineEntry[];
  songs: BandSong[];
  setlisten: SetlisteMitSongs[];
  produktionen: Produktion[];
  aktiverTab: TeamTab;
  kalenderAnsicht: "monat" | "jahr";
  monatParam?: string;
  jahrParam?: string;
  proberaumTermine: ProberaumTermin[];
  termine: KalenderTermin[];
  terminTeilnahme: TerminTeilnahme;
}) {
  const [identitaet, setIdentitaet] = useState<Identitaet | null>(() =>
    ladeIdentitaet(bandId)
  );
  const [nameEingabe, setNameEingabe] = useState("");
  const [registrierungLaeuft, setRegistrierungLaeuft] = useState(false);
  const [registrierungFehler, setRegistrierungFehler] = useState<string | null>(null);
  const [pushHinweis, setPushHinweis] = useState<string | null>(null);
  const [offeneAnfragen, setOffeneAnfragen] = useState<OffeneAnfrageFuerMitglied[]>([]);
  const [antwortLaeuft, setAntwortLaeuft] = useState<Record<string, boolean>>({});
  // Eigene Termin-Antworten, Schlüssel: `${terminId}__${vorkommenDatum}`.
  const [terminAntworten, setTerminAntworten] = useState<Record<string, "kann" | "kann_nicht">>(
    {}
  );
  const [terminAntwortLaeuft, setTerminAntwortLaeuft] = useState<Record<string, boolean>>({});
  // Teilnahme-Übersicht aller Mitglieder (für "X/Y dabei"). Startwert vom
  // Server; die eigene Antwort wird beim Klick optimistisch eingepflegt.
  const [teilnahme, setTeilnahme] = useState<TerminTeilnahme>(terminTeilnahme);
  // Start immer false (Server kennt localStorage nicht -> sonst Hydration-
  // Mismatch); der echte Wert wird nach dem Mount aus localStorage geladen.
  const [dunkelmodus, setDunkelmodus] = useState(false);

  useEffect(() => {
    try {
      // Bewusst erst nach dem Mount aus localStorage lesen (nicht im useState-
      // Initializer), sonst würde der Server-Render (immer hell) vom Client
      // abweichen -> Hydration-Mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDunkelmodus(window.localStorage.getItem(DUNKEL_PREFIX + bandId) === "1");
    } catch {
      // localStorage evtl. nicht verfügbar - Dark-Modus bleibt aus.
    }
  }, [bandId]);

  function toggleDunkelmodus() {
    setDunkelmodus((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(DUNKEL_PREFIX + bandId, next ? "1" : "0");
      } catch {
        // Speichern fehlgeschlagen - Umschaltung gilt trotzdem für diese Sitzung.
      }
      return next;
    });
  }

  async function ladeOffeneAnfragen(mitgliedId: string) {
    const anfragen = await holeOffeneAnfragen(mitgliedId, bandId);
    setOffeneAnfragen(anfragen);
  }

  async function ladeTerminAntworten(mitgliedId: string) {
    const eintraege = await holeTerminAntworten(mitgliedId, bandId);
    setTerminAntworten(
      Object.fromEntries(eintraege.map((e) => [`${e.terminId}__${e.vorkommenDatum}`, e.antwort]))
    );
  }

  async function handleTerminAntwort(
    terminId: string,
    vorkommenDatum: string,
    antwort: "kann" | "kann_nicht"
  ) {
    if (!identitaet) return;
    const key = `${terminId}__${vorkommenDatum}`;
    setTerminAntwortLaeuft((prev) => ({ ...prev, [key]: true }));
    const ergebnis = await beantworteTermin(
      terminId,
      vorkommenDatum,
      identitaet.mitgliedId,
      bandId,
      antwort
    );
    if (ergebnis.ok) {
      setTerminAntworten((prev) => ({ ...prev, [key]: antwort }));
      // Eigenen Eintrag in der Übersicht ersetzen/hinzufügen, damit "X/Y dabei"
      // sofort stimmt (ohne Neuladen).
      setTeilnahme((prev) => {
        const bestehende = prev.antwortenProVorkommen[key] ?? [];
        const ohneEigene = bestehende.filter((a) => a.mitgliedId !== identitaet.mitgliedId);
        return {
          ...prev,
          antwortenProVorkommen: {
            ...prev.antwortenProVorkommen,
            [key]: [
              ...ohneEigene,
              { mitgliedId: identitaet.mitgliedId, name: identitaet.name, antwort },
            ],
          },
        };
      });
    }
    setTerminAntwortLaeuft((prev) => ({ ...prev, [key]: false }));
  }

  useEffect(() => {
    if (!identitaet) return;
    const mitgliedId = identitaet.mitgliedId;

    holeOffeneAnfragen(mitgliedId, bandId).then(setOffeneAnfragen);
    holeTerminAntworten(mitgliedId, bandId).then((eintraege) =>
      setTerminAntworten(
        Object.fromEntries(
          eintraege.map((e) => [`${e.terminId}__${e.vorkommenDatum}`, e.antwort])
        )
      )
    );
    versuchePushSubscription().then(({ subscription, hinweis }) => {
      if (hinweis) setPushHinweis(hinweis);
      if (subscription) {
        aktualisierePushSubscription(mitgliedId, subscription);
      }
    });

    // War die App im Hintergrund (z. B. nur einmal am Morgen geöffnet und
    // seitdem nicht neu gestartet), lädt ein einmaliges Fetch beim Mount
    // neue Anfragen nicht automatisch nach. Beim erneuten Sichtbarwerden
    // (Wechsel zurück in die App) wird deshalb zusätzlich neu geladen.
    function handleSichtbarkeitswechsel() {
      if (document.visibilityState === "visible") {
        holeOffeneAnfragen(mitgliedId, bandId).then(setOffeneAnfragen);
        ladeTerminAntworten(mitgliedId);
      }
    }
    document.addEventListener("visibilitychange", handleSichtbarkeitswechsel);
    return () =>
      document.removeEventListener("visibilitychange", handleSichtbarkeitswechsel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identitaet?.mitgliedId]);

  async function handleRegistrieren(e: React.FormEvent) {
    e.preventDefault();
    if (!nameEingabe.trim()) return;
    setRegistrierungLaeuft(true);
    setRegistrierungFehler(null);

    let ergebnis;
    try {
      const { subscription, hinweis } = await versuchePushSubscription();
      if (hinweis) setPushHinweis(hinweis);
      ergebnis = await registriereMitglied(bandId, nameEingabe, subscription);
    } catch (err) {
      console.error("Registrierung fehlgeschlagen", err);
      setRegistrierungLaeuft(false);
      setRegistrierungFehler(
        "Registrierung fehlgeschlagen (Netzwerkproblem?). Bitte nochmal versuchen."
      );
      return;
    }
    setRegistrierungLaeuft(false);

    if (!ergebnis.ok) {
      setRegistrierungFehler(ergebnis.fehler);
      return;
    }

    const neueIdentitaet: Identitaet = {
      mitgliedId: ergebnis.mitgliedId,
      name: nameEingabe.trim(),
    };
    window.localStorage.setItem(STORAGE_PREFIX + bandId, JSON.stringify(neueIdentitaet));
    setIdentitaet(neueIdentitaet);
  }

  async function handleAntwort(anfrageId: string, antwort: "kann" | "kann_nicht") {
    if (!identitaet) return;
    setAntwortLaeuft((prev) => ({ ...prev, [anfrageId]: true }));
    await beantworteAnfrage(anfrageId, identitaet.mitgliedId, antwort);
    await ladeOffeneAnfragen(identitaet.mitgliedId);
    setAntwortLaeuft((prev) => ({ ...prev, [anfrageId]: false }));
  }

  if (!identitaet) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 pt-16">
        <h1 className="text-xl font-semibold text-slate-900">{bandName}</h1>
        <p className="text-sm text-slate-500">
          Wie heißt du? Wird einmalig auf diesem Gerät gespeichert, kein Passwort nötig.
        </p>
        <form onSubmit={handleRegistrieren} className="flex flex-col gap-3">
          <input
            required
            value={nameEingabe}
            onChange={(e) => setNameEingabe(e.target.value)}
            placeholder="Dein Name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={registrierungLaeuft}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {registrierungLaeuft ? "Wird eingerichtet…" : "Loslegen"}
          </button>
          {registrierungFehler && (
            <p className="text-sm text-red-600">{registrierungFehler}</p>
          )}
        </form>
      </div>
    );
  }

  // Auf dem Dashboard füllt das Band-Logo den ganzen Screen als abgedunkelter
  // Hintergrund (Variante "immersiv dunkel") - Inhalte liegen in hellem Text
  // darüber. Auf den anderen Tabs bleibt es hell.
  const dashboardDunkel = aktiverTab === "dashboard" && !!logoUrl;

  const heute = heuteAlsIsoDatum();
  const naechsteGebuchteTermine = kalenderEintraege
    .filter(
      (e) => e.relation.status === "gebucht" && (e.venue.veranstaltungsdatum ?? "") >= heute
    )
    .sort((a, b) =>
      (a.venue.veranstaltungsdatum ?? "").localeCompare(b.venue.veranstaltungsdatum ?? "")
    )
    .slice(0, 3);

  // Nächstes Proben-Vorkommen ab heute (über Wiederholungen expandiert).
  const naechsteProbe =
    kommendeVorkommen(termine, heute, (t) => t.typ === "probe", 1)[0] ?? null;
  const probeKey = naechsteProbe
    ? `${naechsteProbe.termin.id}__${naechsteProbe.datum}`
    : null;
  const probeAntwort = probeKey ? terminAntworten[probeKey] : undefined;
  const probeBtnUnselected = dashboardDunkel
    ? "border border-white/30 text-white hover:bg-white/10"
    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <div className={clsx(dunkelmodus && "dark")}>
      {dashboardDunkel && (
        <>
          <div
            className="fixed inset-0 z-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${logoUrl})` }}
          />
          <div className="fixed inset-0 z-0 bg-black/[0.58]" />
        </>
      )}
      {dunkelmodus && !dashboardDunkel && (
        <div className="fixed inset-0 z-0 bg-slate-950" />
      )}
      <div className="relative z-10 mx-auto flex max-w-md flex-col gap-6 px-4 pt-8 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
        {dashboardDunkel ? (
          <div>
            <h1 className="text-center text-2xl font-semibold text-white">{bandName}</h1>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-sm text-slate-200">Hi {identitaet.name}!</p>
              <button
                type="button"
                onClick={toggleDunkelmodus}
                aria-label="Dunkelmodus umschalten"
                className="rounded-md border border-white/25 p-1.5 text-white hover:bg-white/10"
              >
                {dunkelmodus ? <SonneIcon /> : <MondIcon />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {bandName}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hi {identitaet.name}!
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleDunkelmodus}
                aria-label="Dunkelmodus umschalten"
                className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {dunkelmodus ? <SonneIcon /> : <MondIcon />}
              </button>
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={bandName}
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
              )}
            </div>
          </div>
        )}

        {pushHinweis && (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">{pushHinweis}</p>
        )}

      {aktiverTab === "dashboard" && (
        <>
          <div>
            <h2
              className={clsx(
                "mb-2 text-sm font-semibold",
                dashboardDunkel ? "text-white" : "text-slate-900"
              )}
            >
              Nächste Probe
            </h2>
            {naechsteProbe ? (
              <div
                className={clsx(
                  "rounded-lg border p-3",
                  dashboardDunkel
                    ? "border-white/15 bg-white/10 backdrop-blur-sm"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                )}
              >
                <p
                  className={clsx(
                    "font-medium",
                    dashboardDunkel ? "text-white" : "text-slate-900 dark:text-slate-100"
                  )}
                >
                  {naechsteProbe.termin.titel}
                </p>
                <p
                  className={clsx(
                    "mt-0.5 text-sm",
                    dashboardDunkel ? "text-slate-200" : "text-slate-600 dark:text-slate-300"
                  )}
                >
                  {formatTerminDatum(naechsteProbe.datum)}
                  {naechsteProbe.termin.uhrzeit
                    ? ` · ${naechsteProbe.termin.uhrzeit.slice(0, 5)} Uhr`
                    : ""}
                  {naechsteProbe.termin.ort ? ` · ${naechsteProbe.termin.ort}` : ""}
                </p>

                <p
                  className={clsx(
                    "mt-2 text-xs font-medium",
                    probeAntwort === "kann"
                      ? "text-green-400"
                      : probeAntwort === "kann_nicht"
                        ? "text-red-400"
                        : dashboardDunkel
                          ? "text-slate-300"
                          : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  {probeAntwort === "kann"
                    ? "✓ Du bist dabei"
                    : probeAntwort === "kann_nicht"
                      ? "✗ Du hast abgesagt"
                      : "Bist du dabei?"}
                </p>
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    disabled={probeKey ? terminAntwortLaeuft[probeKey] : false}
                    onClick={() =>
                      handleTerminAntwort(naechsteProbe.termin.id, naechsteProbe.datum, "kann")
                    }
                    className={clsx(
                      "flex-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50",
                      probeAntwort === "kann"
                        ? "bg-green-600 text-white"
                        : probeBtnUnselected
                    )}
                  >
                    Ich bin dabei
                  </button>
                  <button
                    type="button"
                    disabled={probeKey ? terminAntwortLaeuft[probeKey] : false}
                    onClick={() =>
                      handleTerminAntwort(
                        naechsteProbe.termin.id,
                        naechsteProbe.datum,
                        "kann_nicht"
                      )
                    }
                    className={clsx(
                      "flex-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50",
                      probeAntwort === "kann_nicht"
                        ? "bg-red-600 text-white"
                        : probeBtnUnselected
                    )}
                  >
                    Ich kann nicht
                  </button>
                </div>

                <div
                  className={clsx(
                    "mt-3 border-t pt-2",
                    dashboardDunkel ? "border-white/15" : "border-slate-200 dark:border-slate-700"
                  )}
                >
                  <TerminTeilnahmeUebersicht
                    stand={berechneTeilnahme(
                      teilnahme,
                      naechsteProbe.termin.id,
                      naechsteProbe.datum,
                      bandId
                    )}
                    aufDunkel={dashboardDunkel}
                  />
                </div>
              </div>
            ) : (
              <p className={clsx("text-sm", dashboardDunkel ? "text-slate-200" : "text-slate-500 dark:text-slate-400")}>
                Keine Probe geplant.
              </p>
            )}
          </div>

          <div>
            <h2
              className={clsx(
                "mb-2 text-sm font-semibold",
                dashboardDunkel ? "text-white" : "text-slate-900"
              )}
            >
              Offene Anfragen
            </h2>
            {offeneAnfragen.length === 0 ? (
              <p className={clsx("text-sm", dashboardDunkel ? "text-slate-200" : "text-slate-500")}>
                Aktuell nichts zu bestätigen.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {offeneAnfragen.map((anfrage) => (
                  <li
                    key={anfrage.id}
                    className={clsx(
                      "rounded-lg border p-3",
                      dashboardDunkel
                        ? "border-white/15 bg-white/10 backdrop-blur-sm"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    <p
                      className={clsx(
                        "font-medium",
                        dashboardDunkel ? "text-white" : "text-slate-900"
                      )}
                    >
                      {anfrage.venue.name}
                    </p>
                    <p
                      className={clsx(
                        "text-xs",
                        dashboardDunkel ? "text-slate-300" : "text-slate-500"
                      )}
                    >
                      {anfrage.venue.veranstaltungsdatum
                        ? anfrage.venue.veranstaltungsdatum.split("-").reverse().join(".")
                        : "Termin noch offen"}
                      {anfrage.venue.ort ? ` · ${anfrage.venue.ort}` : ""}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={antwortLaeuft[anfrage.id]}
                        onClick={() => handleAntwort(anfrage.id, "kann")}
                        className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Ich kann
                      </button>
                      <button
                        type="button"
                        disabled={antwortLaeuft[anfrage.id]}
                        onClick={() => handleAntwort(anfrage.id, "kann_nicht")}
                        className={clsx(
                          "flex-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50",
                          dashboardDunkel
                            ? "bg-white/90 text-red-600 hover:bg-white"
                            : "border border-red-300 text-red-600 hover:bg-red-50"
                        )}
                      >
                        Ich kann nicht
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2
              className={clsx(
                "mb-2 text-sm font-semibold",
                dashboardDunkel ? "text-white" : "text-slate-900"
              )}
            >
              Nächste Termine
            </h2>
            {naechsteGebuchteTermine.length === 0 ? (
              <p className={clsx("text-sm", dashboardDunkel ? "text-slate-200" : "text-slate-500")}>
                Aktuell keine gebuchten Termine.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {naechsteGebuchteTermine.map((eintrag) => (
                  <li
                    key={eintrag.relation.id}
                    className={clsx(
                      "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                      kalenderPillFarbe(bandName, "gebucht")
                    )}
                  >
                    <span className="font-medium">{eintrag.venue.name}</span>
                    <span>
                      {eintrag.venue.veranstaltungsdatum?.split("-").reverse().join(".")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={tabLink("kalender")}
              className={clsx(
                "mt-3 inline-block text-xs font-medium underline",
                dashboardDunkel ? "text-slate-200" : "text-slate-600"
              )}
            >
              Alle Termine im Kalender ansehen
            </Link>
          </div>
        </>
      )}

      {aktiverTab === "kalender" && (
        <div>
          <div className="mb-4 inline-flex rounded-md border border-slate-300 text-sm font-medium dark:border-slate-600">
            <Link
              href={`?tab=kalender&ansicht=monat${monatParam ? `&monat=${monatParam}` : ""}`}
              className={clsx(
                "w-20 rounded-l-md py-1.5 text-center",
                kalenderAnsicht === "monat"
                  ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              Monat
            </Link>
            <Link
              href={`?tab=kalender&ansicht=jahr${jahrParam ? `&jahr=${jahrParam}` : ""}`}
              className={clsx(
                "w-20 rounded-r-md border-l border-slate-300 py-1.5 text-center dark:border-slate-600",
                kalenderAnsicht === "jahr"
                  ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              Jahr
            </Link>
          </div>
          {kalenderAnsicht === "monat" ? (
            <KalenderMonatsView
              eintraege={kalenderEintraege}
              monatParam={monatParam}
              bandFilter={ALLE_BANDS_PARAM}
              tabParam="kalender"
              zeigeBandName={false}
              venueLinkErlaubt={false}
              proberaumTermine={proberaumTermine}
              termine={termine}
              terminTeilnahme={teilnahme}
              kompakt
              vorGitter={
                <TermineManager
                  bands={[{ id: bandId, name: bandName }]}
                  bandFilter={bandId}
                  initialTermine={termine}
                />
              }
            />
          ) : (
            <KalenderJahresView
              eintraege={kalenderEintraege}
              jahrParam={jahrParam}
              bandFilter={ALLE_BANDS_PARAM}
              tabParam="kalender"
              proberaumTermine={proberaumTermine}
              termine={termine}
              kompakt
              vorGitter={
                <TermineManager
                  bands={[{ id: bandId, name: bandName }]}
                  bandFilter={bandId}
                  initialTermine={termine}
                />
              }
            />
          )}
          <a
            href={`/api/kalender/${bandId}`}
            className="mt-4 inline-block text-xs font-medium text-slate-600 underline dark:text-slate-300"
          >
            Kalender abonnieren (für privaten Kalender) ↗
          </a>
        </div>
      )}

      {aktiverTab === "setliste" && (
        <div>
          <SetlisteBuilder bandId={bandId} initialSongs={songs} initialSetlisten={setlisten} />
        </div>
      )}

      {aktiverTab === "produktion" && (
        <div>
          <ProduktionListe bandId={bandId} initialProduktionen={produktionen} />
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex max-w-md">
          {(
            [
              { tab: "dashboard" as const, label: "Dashboard", icon: <HomeIcon /> },
              { tab: "kalender" as const, label: "Kalender", icon: <CalendarIcon /> },
              { tab: "setliste" as const, label: "Setliste", icon: <SetlisteIcon /> },
              { tab: "produktion" as const, label: "Prod.", icon: <ProduktionIcon /> },
            ]
          ).map((item) => (
            <Link
              key={item.tab}
              href={tabLink(item.tab)}
              className={clsx(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                aktiverTab === item.tab
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-400 dark:text-slate-500"
              )}
            >
              {item.icon}
              {item.tab === "dashboard" && offeneAnfragen.length > 0 && (
                <span className="absolute right-[calc(50%-20px)] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-medium text-white">
                  {offeneAnfragen.length}
                </span>
              )}
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      </div>
    </div>
  );
}
