"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  registriereMitglied,
  aktualisierePushSubscription,
  holeOffeneAnfragen,
  beantworteAnfrage,
  type PushSubscriptionInput,
} from "@/lib/teamActions";
import { kalenderPillFarbe } from "@/lib/kalenderHelpers";
import type { OffeneAnfrageFuerMitglied, PipelineEntry } from "@/lib/types";

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
}: {
  bandId: string;
  bandName: string;
  kalenderEintraege: PipelineEntry[];
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
    holeOffeneAnfragen(identitaet.mitgliedId, bandId).then(setOffeneAnfragen);
    versuchePushSubscription().then(({ subscription, hinweis }) => {
      if (hinweis) setPushHinweis(hinweis);
      if (subscription) {
        aktualisierePushSubscription(identitaet.mitgliedId, subscription);
      }
    });
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

  const sortierteEintraege = [...kalenderEintraege].sort((a, b) =>
    (a.venue.veranstaltungsdatum ?? "").localeCompare(b.venue.veranstaltungsdatum ?? "")
  );

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{bandName}</h1>
        <p className="text-sm text-slate-500">Hi {identitaet.name}!</p>
      </div>

      {pushHinweis && (
        <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">{pushHinweis}</p>
      )}

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
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Kalender</h2>
        {sortierteEintraege.length === 0 ? (
          <p className="text-sm text-slate-500">Noch keine Termine.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {sortierteEintraege.map((eintrag) => (
              <li
                key={eintrag.relation.id}
                className={clsx(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                  kalenderPillFarbe(
                    bandName,
                    eintrag.relation.status as "gebucht" | "interessiert"
                  )
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
        <a
          href={`/api/kalender/${bandId}`}
          className="mt-3 inline-block text-xs font-medium text-slate-600 underline"
        >
          Kalender abonnieren (für privaten Kalender) ↗
        </a>
      </div>
    </div>
  );
}
