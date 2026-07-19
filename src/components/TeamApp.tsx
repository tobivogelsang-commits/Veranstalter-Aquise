"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  registriereMitglied,
  aktualisierePushSubscription,
  holeOffeneAnfragen,
  beantworteAnfrage,
  type PushSubscriptionInput,
} from "@/lib/teamActions";
import { kalenderPillFarbe } from "@/lib/kalenderHelpers";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import { SetlisteBuilder } from "@/components/SetlisteBuilder";
import { KalenderMonatsView } from "@/components/KalenderMonatsView";
import { KalenderJahresView } from "@/components/KalenderJahresView";
import type { BandSong, OffeneAnfrageFuerMitglied, PipelineEntry } from "@/lib/types";
import type { SetlisteMitSongs } from "@/lib/queries";
import type { ProberaumTermin } from "@/lib/proberaumKalender";

type TeamTab = "dashboard" | "kalender" | "setliste";

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

const STORAGE_PREFIX = "team-mitglied:";

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
  kalenderEintraege,
  songs,
  setlisten,
  aktiverTab,
  kalenderAnsicht,
  monatParam,
  jahrParam,
  proberaumTermine,
}: {
  bandId: string;
  bandName: string;
  kalenderEintraege: PipelineEntry[];
  songs: BandSong[];
  setlisten: SetlisteMitSongs[];
  aktiverTab: TeamTab;
  kalenderAnsicht: "monat" | "jahr";
  monatParam?: string;
  jahrParam?: string;
  proberaumTermine: ProberaumTermin[];
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

  async function ladeOffeneAnfragen(mitgliedId: string) {
    const anfragen = await holeOffeneAnfragen(mitgliedId, bandId);
    setOffeneAnfragen(anfragen);
  }

  useEffect(() => {
    if (!identitaet) return;
    const mitgliedId = identitaet.mitgliedId;

    holeOffeneAnfragen(mitgliedId, bandId).then(setOffeneAnfragen);
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

    const { subscription, hinweis } = await versuchePushSubscription();
    if (hinweis) setPushHinweis(hinweis);

    const ergebnis = await registriereMitglied(bandId, nameEingabe, subscription);
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

  const heute = heuteAlsIsoDatum();
  const naechsteGebuchteTermine = kalenderEintraege
    .filter(
      (e) => e.relation.status === "gebucht" && (e.venue.veranstaltungsdatum ?? "") >= heute
    )
    .sort((a, b) =>
      (a.venue.veranstaltungsdatum ?? "").localeCompare(b.venue.veranstaltungsdatum ?? "")
    )
    .slice(0, 3);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-24 pt-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{bandName}</h1>
        <p className="text-sm text-slate-500">Hi {identitaet.name}!</p>
      </div>

      {pushHinweis && (
        <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">{pushHinweis}</p>
      )}

      {aktiverTab === "dashboard" && (
        <>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Offene Anfragen</h2>
            {offeneAnfragen.length === 0 ? (
              <p className="text-sm text-slate-500">Aktuell nichts zu bestätigen.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {offeneAnfragen.map((anfrage) => (
                  <li
                    key={anfrage.id}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <p className="font-medium text-slate-900">{anfrage.venue.name}</p>
                    <p className="text-xs text-slate-500">
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
                        className="flex-1 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
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
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Nächste Termine</h2>
            {naechsteGebuchteTermine.length === 0 ? (
              <p className="text-sm text-slate-500">Aktuell keine gebuchten Termine.</p>
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
              className="mt-3 inline-block text-xs font-medium text-slate-600 underline"
            >
              Alle Termine im Kalender ansehen
            </Link>
          </div>
        </>
      )}

      {aktiverTab === "kalender" && (
        <div>
          <div className="mb-4 flex rounded-md border border-slate-300 text-sm font-medium">
            <Link
              href={`?tab=kalender&ansicht=monat${monatParam ? `&monat=${monatParam}` : ""}`}
              className={clsx(
                "rounded-l-md px-3 py-1.5",
                kalenderAnsicht === "monat"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              Monat
            </Link>
            <Link
              href={`?tab=kalender&ansicht=jahr${jahrParam ? `&jahr=${jahrParam}` : ""}`}
              className={clsx(
                "rounded-r-md border-l border-slate-300 px-3 py-1.5",
                kalenderAnsicht === "jahr"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
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
            />
          ) : (
            <KalenderJahresView
              eintraege={kalenderEintraege}
              jahrParam={jahrParam}
              bandFilter={ALLE_BANDS_PARAM}
              tabParam="kalender"
              proberaumTermine={proberaumTermine}
            />
          )}
          <a
            href={`/api/kalender/${bandId}`}
            className="mt-4 inline-block text-xs font-medium text-slate-600 underline"
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

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md">
          {(
            [
              { tab: "dashboard" as const, label: "Dashboard", icon: <HomeIcon /> },
              { tab: "kalender" as const, label: "Kalender", icon: <CalendarIcon /> },
              { tab: "setliste" as const, label: "Setliste", icon: <SetlisteIcon /> },
            ]
          ).map((item) => (
            <Link
              key={item.tab}
              href={tabLink(item.tab)}
              className={clsx(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                aktiverTab === item.tab ? "text-slate-900" : "text-slate-400"
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
  );
}
