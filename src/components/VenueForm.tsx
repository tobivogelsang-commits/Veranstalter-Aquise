"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import {
  autosaveVenue,
  createVenue,
  deleteVenue,
  rechercheKontakt,
  updateStatus,
} from "@/lib/actions";
import {
  GIG_ANSPRECHPARTNER_ROLLEN,
  STATUS_LABELS,
  STATUS_ORDER,
  VENUE_TYPEN,
} from "@/lib/constants";
import { TELEFONAT_ZUSENDUNG } from "@/lib/protokollTypen";
import { berechneSetZeiten } from "@/lib/setzeiten";
import { formatDauer, summeDauer } from "@/lib/dauer";
import type { GigAnsprechpartner, Status } from "@/lib/database.types";
import type {
  Band,
  BandDokumentTypMitUrl,
  BandMaterial,
  EmailVorlage,
  GigAnfrageMitAntworten,
  VenueBandDokument,
  VenueBandProtokoll,
  VenueEmailMitBand,
  VenueWithRelations,
} from "@/lib/types";
import type { SetlisteMitSongs } from "@/lib/queries";
import { SpeichernToast } from "@/components/SpeichernToast";
import { AnfrageBadge } from "@/components/TeamAnfragenList";
import { DokumentChecklist } from "@/components/DokumentChecklist";
import { VenueEmailThread } from "@/components/VenueEmailThread";
import { VenueProtokoll } from "@/components/VenueProtokoll";

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function normalizeTelefon(telefon: string) {
  return telefon.replace(/[^+\d]/g, "");
}

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

type FelderState = {
  name: string;
  typ: string;
  ort: string;
  region: string;
  strasse: string;
  website: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  ansprechpartner: string;
  email: string;
  telefon: string;
  quelle: string;
  notizen: string;
  veranstaltungsdatum: string;
  gig_einlass: string;
  gig_soundcheck: string;
  gig_beginn: string;
  gig_treffen_proberaum: string;
  gig_zeiten_notiz: string;
  gig_logistik: string;
  gig_setliste_id: string;
};

export function VenueForm({
  bands,
  venue,
  emails,
  anfragen,
  mitgliederProBand,
  vorlagenProBand,
  dokumentTypenProBand,
  materialienProBand,
  setlistenProBand,
  dokumente,
  protokoll,
}: {
  bands: Band[];
  venue?: VenueWithRelations;
  emails?: VenueEmailMitBand[];
  anfragen?: GigAnfrageMitAntworten[];
  mitgliederProBand?: Record<string, number>;
  vorlagenProBand?: Record<string, EmailVorlage[]>;
  dokumentTypenProBand?: Record<string, BandDokumentTypMitUrl[]>;
  materialienProBand?: Record<string, BandMaterial[]>;
  setlistenProBand?: Record<string, SetlisteMitSongs[]>;
  dokumente?: VenueBandDokument[];
  protokoll?: VenueBandProtokoll[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [speichernSignal, setSpeichernSignal] = useState(0);
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);

  // Speichert das komplette Formular sofort (Blur/Change statt Button) - liest
  // die aktuellen DOM-Werte direkt aus dem Formular, das deckt auch
  // unkontrollierte Felder wie den Follow-up-Termin pro Band ab.
  async function autosave() {
    if (!venue || !formRef.current) return;
    const formData = new FormData(formRef.current);
    const ergebnis = await autosaveVenue(venue.id, formData);
    if (!ergebnis.ok) {
      setSpeicherFehler(ergebnis.fehler);
      return;
    }
    setSpeicherFehler(null);
    setSpeichernSignal((n) => n + 1);
  }

  const [felder, setFelder] = useState<FelderState>({
    name: venue?.name ?? "",
    typ: venue?.typ ?? "",
    ort: venue?.ort ?? "",
    region: venue?.region ?? "",
    strasse: venue?.strasse ?? "",
    website: venue?.website ?? "",
    instagram: venue?.instagram ?? "",
    tiktok: venue?.tiktok ?? "",
    facebook: venue?.facebook ?? "",
    ansprechpartner: venue?.ansprechpartner ?? "",
    email: venue?.email ?? "",
    telefon: venue?.telefon ?? "",
    quelle: venue?.quelle ?? "",
    notizen: venue?.notizen ?? "",
    veranstaltungsdatum: venue?.veranstaltungsdatum ?? "",
    gig_einlass: venue?.gig_einlass?.slice(0, 5) ?? "",
    gig_soundcheck: venue?.gig_soundcheck?.slice(0, 5) ?? "",
    gig_beginn: venue?.gig_beginn?.slice(0, 5) ?? "",
    gig_treffen_proberaum: venue?.gig_treffen_proberaum?.slice(0, 5) ?? "",
    gig_zeiten_notiz: venue?.gig_zeiten_notiz ?? "",
    gig_logistik: venue?.gig_logistik ?? "",
    gig_setliste_id: venue?.gig_setliste_id ?? "",
  });

  function setFeld<K extends keyof FelderState>(key: K, value: FelderState[K]) {
    setFelder((prev) => ({ ...prev, [key]: value }));
  }

  // Ansprechpartner vor Ort (mehrere, je mit Rolle). Eigener State, weil
  // dynamische Liste - wird als JSON in ein Hidden-Input geschrieben, das der
  // Autosave mitliest. Seed aus den Alt-Einzelfeldern (Migration 0021), falls
  // die Liste noch leer ist, damit ein evtl. getesteter Kontakt nicht verloren geht.
  const [ansprechpartner, setAnsprechpartner] = useState<GigAnsprechpartner[]>(
    () => {
      const liste = venue?.gig_ansprechpartner ?? [];
      if (liste.length > 0) return liste;
      if (venue?.gig_kontakt_name || venue?.gig_kontakt_telefon) {
        return [
          {
            rolle: "",
            name: venue.gig_kontakt_name ?? "",
            telefon: venue.gig_kontakt_telefon ?? "",
          },
        ];
      }
      return [];
    }
  );

  // Autosave erst nach dem DOM-Commit (Hidden-Input muss den neuen Wert tragen).
  function setAnsprechpartnerUndSpeichere(next: GigAnsprechpartner[]) {
    setAnsprechpartner(next);
    setTimeout(autosave, 0);
  }

  function aendereAnsprechpartner(
    index: number,
    feld: keyof GigAnsprechpartner,
    wert: string
  ) {
    setAnsprechpartner((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [feld]: wert } : e))
    );
  }

  const [linked, setLinked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const band of bands) {
      initial[band.id] = Boolean(
        venue?.venue_band_status.find((r) => r.band_id === band.id)
      );
    }
    return initial;
  });

  function relationFor(bandId: string) {
    return venue?.venue_band_status.find((r) => r.band_id === bandId);
  }

  // Aktuellste Team-Anfrage für diese Band an diesem Veranstalter - eine
  // offene hat Vorrang, sonst die zuletzt erstellte (z. B. bereits
  // bestätigt/abgesagt).
  function anfrageFuerBand(bandId: string): GigAnfrageMitAntworten | null {
    const liste = (anfragen ?? []).filter((a) => a.band_id === bandId);
    if (liste.length === 0) return null;
    return (
      liste.find((a) => a.status === "offen") ??
      liste.sort((a, b) => b.erstellt_am.localeCompare(a.erstellt_am))[0]
    );
  }

  const [bandStatus, setBandStatus] = useState<Record<string, Status>>(() => {
    const initial: Record<string, Status> = {};
    for (const band of bands) {
      initial[band.id] = relationFor(band.id)?.status ?? "neu";
    }
    return initial;
  });

  const [letzterKontakt, setLetzterKontakt] = useState<
    Record<string, string | null>
  >(() => {
    const initial: Record<string, string | null> = {};
    for (const band of bands) {
      initial[band.id] = relationFor(band.id)?.letzter_kontakt_am ?? null;
    }
    return initial;
  });

  // Öffnet die Website und markiert alle verknüpften Bands, die noch auf
  // "neu" stehen, automatisch als "recherchiert" (das Ansehen der Website
  // *ist* die Recherche). Weiter fortgeschrittene Status werden nicht
  // zurückgesetzt.
  function handleWebsiteAnsehen() {
    if (!venue) return;
    for (const band of bands) {
      if (!linked[band.id]) continue;
      if (bandStatus[band.id] !== "neu") continue;
      setBandStatus((prev) => ({ ...prev, [band.id]: "recherchiert" }));
      setLetzterKontakt((prev) => ({
        ...prev,
        [band.id]: new Date().toISOString(),
      }));
      updateStatus(venue.id, band.id, "recherchiert").catch((err) => {
        console.error("Status-Update fehlgeschlagen", err);
      });
    }
  }

  const [recherche, setRecherche] = useState<{
    laeuft: boolean;
    fehler: string | null;
    quelleUrl: string | null;
    impressumUrl: string | null;
    hinweis: string | null;
    kiWarnung: string | null;
  }>({
    laeuft: false,
    fehler: null,
    quelleUrl: null,
    impressumUrl: null,
    hinweis: null,
    kiWarnung: null,
  });

  async function handleRecherche() {
    setRecherche({
      laeuft: true,
      fehler: null,
      quelleUrl: null,
      impressumUrl: null,
      hinweis: null,
      kiWarnung: null,
    });
    const ergebnis = await rechercheKontakt(
      felder.name,
      felder.ort || null,
      felder.website || null
    );

    if (!ergebnis.ok) {
      setRecherche({
        laeuft: false,
        fehler: ergebnis.fehler,
        quelleUrl: null,
        impressumUrl: null,
        hinweis: null,
        kiWarnung: null,
      });
      return;
    }

    const { daten } = ergebnis;
    const gefuellt: string[] = [];
    const next = { ...felder };

    if (!felder.website && daten.website) {
      next.website = daten.website;
      gefuellt.push("Website");
    }
    if (!felder.instagram && daten.instagram) {
      next.instagram = daten.instagram;
      gefuellt.push("Instagram");
    }
    if (!felder.tiktok && daten.tiktok) {
      next.tiktok = daten.tiktok;
      gefuellt.push("TikTok");
    }
    if (!felder.facebook && daten.facebook) {
      next.facebook = daten.facebook;
      gefuellt.push("Facebook");
    }
    if (!felder.telefon && daten.telefon) {
      next.telefon = daten.telefon;
      gefuellt.push("Telefon");
    }
    if (!felder.email && daten.email) {
      next.email = daten.email;
      gefuellt.push("E-Mail");
    }
    if (!felder.ansprechpartner && daten.ansprechpartner) {
      next.ansprechpartner = daten.ansprechpartner;
      gefuellt.push("Ansprechpartner");
    }
    if (!felder.strasse && daten.adresse) {
      next.strasse = daten.adresse;
      gefuellt.push("Adresse");
    }
    if (!felder.ort && daten.ort) {
      next.ort = daten.ort;
      gefuellt.push("Ort");
    }

    // Bewusst kein Schreiben in die Notizen mehr: Quelle/Adresse/Ausschnitt
    // waren hier nur Belege für Website/Telefon/E-Mail/Adresse, die jetzt
    // direkt in die entsprechenden Felder wandern. Die Notizen bleiben so den
    // Veranstaltungsinformationen vorbehalten (Termin, Programm etc.).
    setFelder(next);
    if (gefuellt.length > 0) {
      // Autosave erst nachdem React die neuen Feldwerte ins DOM committet hat
      // (autosave liest das Formular direkt aus, nicht aus dem next-Objekt).
      setTimeout(() => {
        autosave();
      }, 0);
    }

    setRecherche({
      laeuft: false,
      fehler: null,
      quelleUrl: daten.quelleUrl,
      impressumUrl: daten.impressumUrl,
      hinweis:
        gefuellt.length > 0
          ? `Automatisch ausgefüllt: ${gefuellt.join(", ")}. Bitte prüfen.`
          : "Keine leeren Felder zum Ausfüllen gefunden.",
      kiWarnung: daten.kiWarnung,
    });
  }

  // Setlisten der aktuell gebuchten Band(s) für die Gig-Setlisten-Auswahl; bei
  // mehreren gebuchten Bands mit Bandname präfixiert.
  const gebuchteBandIds = bands
    .filter((b) => bandStatus[b.id] === "gebucht")
    .map((b) => b.id);
  const setlistenOptionen = gebuchteBandIds.flatMap((bid) =>
    (setlistenProBand?.[bid] ?? []).map((sl) => ({
      id: sl.id,
      label:
        gebuchteBandIds.length > 1
          ? `${bands.find((b) => b.id === bid)?.name ?? ""}: ${sl.name}`
          : sl.name,
      setliste: sl,
    }))
  );
  const gewaehlteSetliste =
    setlistenOptionen.find((o) => o.id === felder.gig_setliste_id)?.setliste ?? null;
  const setZeiten = gewaehlteSetliste
    ? berechneSetZeiten(
        felder.gig_beginn,
        gewaehlteSetliste.songs,
        gewaehlteSetliste.pausen ?? []
      )
    : null;

  return (
    <>
      <SpeichernToast trigger={speichernSignal} />
      <form
        ref={formRef}
        action={venue ? undefined : createVenue}
        onSubmit={venue ? (e) => e.preventDefault() : undefined}
        className="flex max-w-2xl flex-col gap-6"
      >
      {venue && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={recherche.laeuft}
              onClick={handleRecherche}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {recherche.laeuft ? "Suche läuft…" : "Kontakt vervollständigen"}
            </button>
            <span className="text-xs text-slate-500">
              Sucht über SerpApi anhand von Name + Ort und ergänzt fehlende
              Felder zusätzlich aus dem Impressum der Website. Füllt nur leere
              Felder.
            </span>
          </div>
          {recherche.fehler && (
            <p className="mt-2 text-sm text-red-600">{recherche.fehler}</p>
          )}
          {recherche.hinweis && (
            <p className="mt-2 text-sm text-green-700">{recherche.hinweis}</p>
          )}
          {recherche.kiWarnung && (
            <p className="mt-2 text-sm text-amber-700">
              ⚠️ KI-Hinweis: {recherche.kiWarnung}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-3">
            {recherche.quelleUrl && (
              <a
                href={recherche.quelleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-medium text-slate-600 underline hover:text-slate-900"
              >
                Quelle ansehen ↗
              </a>
            )}
            {recherche.impressumUrl && (
              <a
                href={recherche.impressumUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-medium text-slate-600 underline hover:text-slate-900"
              >
                Impressum ansehen ↗
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name *">
          <input
            name="name"
            required
            value={felder.name}
            onChange={(e) => setFeld("name", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
        </Field>
        <Field label="Veranstaltungsdatum">
          <input
            type="date"
            name="veranstaltungsdatum"
            value={felder.veranstaltungsdatum}
            onChange={(e) => setFeld("veranstaltungsdatum", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
        </Field>
        <Field label="Typ">
          <select
            name="typ"
            value={felder.typ}
            onChange={(e) => {
              setFeld("typ", e.target.value);
              autosave();
            }}
            className={inputClass}
          >
            <option value="">- wählen -</option>
            {VENUE_TYPEN.map((typ) => (
              <option key={typ} value={typ}>
                {typ}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ort">
          <input
            name="ort"
            value={felder.ort}
            onChange={(e) => setFeld("ort", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
        </Field>
        <Field label="Region">
          <input
            name="region"
            value={felder.region}
            onChange={(e) => setFeld("region", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
        </Field>
        <Field label="Straße/Hausnummer">
          <input
            name="strasse"
            value={felder.strasse}
            onChange={(e) => setFeld("strasse", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
        </Field>
        <Field label="Website">
          <input
            name="website"
            value={felder.website}
            onChange={(e) => setFeld("website", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
          {felder.website && (
            <a
              href={normalizeUrl(felder.website)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWebsiteAnsehen}
              className="mt-1 self-start text-xs font-medium text-slate-600 underline hover:text-slate-900"
            >
              Webseite ansehen ↗
            </a>
          )}
        </Field>
        <Field label="Instagram">
          <input
            name="instagram"
            value={felder.instagram}
            onChange={(e) => setFeld("instagram", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
          {felder.instagram && (
            <a
              href={normalizeUrl(felder.instagram)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 self-start text-xs font-medium text-slate-600 underline hover:text-slate-900"
            >
              Profil ansehen ↗
            </a>
          )}
        </Field>
        <Field label="TikTok">
          <input
            name="tiktok"
            value={felder.tiktok}
            onChange={(e) => setFeld("tiktok", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
          {felder.tiktok && (
            <a
              href={normalizeUrl(felder.tiktok)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 self-start text-xs font-medium text-slate-600 underline hover:text-slate-900"
            >
              Profil ansehen ↗
            </a>
          )}
        </Field>
        <Field label="Facebook">
          <input
            name="facebook"
            value={felder.facebook}
            onChange={(e) => setFeld("facebook", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
          {felder.facebook && (
            <a
              href={normalizeUrl(felder.facebook)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 self-start text-xs font-medium text-slate-600 underline hover:text-slate-900"
            >
              Profil ansehen ↗
            </a>
          )}
        </Field>
        <Field label="Ansprechpartner">
          <input
            name="ansprechpartner"
            value={felder.ansprechpartner}
            onChange={(e) => setFeld("ansprechpartner", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
        </Field>
        <Field label="E-Mail">
          <input
            name="email"
            type="email"
            value={felder.email}
            onChange={(e) => setFeld("email", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
        </Field>
        <Field label="Telefon">
          <input
            name="telefon"
            value={felder.telefon}
            onChange={(e) => setFeld("telefon", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
          {felder.telefon && (
            <a
              href={`tel:${normalizeTelefon(felder.telefon)}`}
              className="mt-1 self-start text-xs font-medium text-slate-600 underline hover:text-slate-900"
            >
              Anrufen ↗
            </a>
          )}
        </Field>
        <Field label="Quelle">
          <input
            name="quelle"
            value={felder.quelle}
            onChange={(e) => setFeld("quelle", e.target.value)}
            onBlur={autosave}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Notizen">
        <textarea
          name="notizen"
          rows={8}
          value={felder.notizen}
          onChange={(e) => setFeld("notizen", e.target.value)}
          onBlur={autosave}
          className={inputClass}
        />
      </Field>

      {Object.values(bandStatus).includes("gebucht") && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <h2 className="mb-1 text-base font-medium text-slate-900">
            Gebuchter Auftritt
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Diese Infos sehen die Bandmitglieder in der Team-App (ohne Gage).
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Treffen Proberaum">
              <input
                type="time"
                name="gig_treffen_proberaum"
                value={felder.gig_treffen_proberaum}
                onChange={(e) => setFeld("gig_treffen_proberaum", e.target.value)}
                onBlur={autosave}
                className={inputClass}
              />
            </Field>
            <Field label="Soundcheck">
              <input
                type="time"
                name="gig_soundcheck"
                value={felder.gig_soundcheck}
                onChange={(e) => setFeld("gig_soundcheck", e.target.value)}
                onBlur={autosave}
                className={inputClass}
              />
            </Field>
            <Field label="Einlass / Load-in">
              <input
                type="time"
                name="gig_einlass"
                value={felder.gig_einlass}
                onChange={(e) => setFeld("gig_einlass", e.target.value)}
                onBlur={autosave}
                className={inputClass}
              />
            </Field>
            <Field label="Auftrittsbeginn">
              <input
                type="time"
                name="gig_beginn"
                value={felder.gig_beginn}
                onChange={(e) => setFeld("gig_beginn", e.target.value)}
                onBlur={autosave}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Setliste für den Auftritt">
              <select
                name="gig_setliste_id"
                value={felder.gig_setliste_id}
                onChange={(e) => {
                  setFeld("gig_setliste_id", e.target.value);
                  autosave();
                }}
                className={inputClass}
              >
                <option value="">- keine -</option>
                {setlistenOptionen.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            {felder.gig_setliste_id && setlistenOptionen.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Die gewählte Setliste gehört nicht zur gebuchten Band.
              </p>
            )}
            {gewaehlteSetliste && !felder.gig_beginn && (
              <p className="mt-1 text-xs text-slate-500">
                Auftrittsbeginn eintragen, um das Ende zu berechnen.
              </p>
            )}
            {gewaehlteSetliste && gewaehlteSetliste.songs.length > 0 && (
              <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
                <div className="flex flex-col gap-0.5 text-slate-700">
                  {gewaehlteSetliste.songs.map((song, i) => (
                    <div key={song.id} className="flex justify-between gap-3">
                      <span>
                        {i + 1}. {song.titel}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        {formatDauer(song.dauer_sekunden)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between gap-3 border-t border-slate-200 pt-1 font-medium text-slate-900">
                  <span>Gesamtlaufzeit</span>
                  <span className="shrink-0 tabular-nums">
                    {formatDauer(summeDauer(gewaehlteSetliste.songs.map((s) => s.dauer_sekunden)))}
                  </span>
                </div>
                {setZeiten && (
                  <div className="mt-1 flex justify-between">
                    <span className="text-slate-600">Ende Auftritt</span>
                    <span className="font-medium text-slate-900">{setZeiten.ende}</span>
                  </div>
                )}
                {setZeiten?.fehlendeDauern && (
                  <p className="mt-1 text-xs text-amber-600">
                    Nicht alle Songs haben eine Dauer – das Ende ist eine Untergrenze.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <Field label="Notizen zum Auftritt">
              <textarea
                name="gig_zeiten_notiz"
                rows={2}
                value={felder.gig_zeiten_notiz}
                onChange={(e) => setFeld("gig_zeiten_notiz", e.target.value)}
                onBlur={autosave}
                className={inputClass}
              />
            </Field>
            <Field label="Logistik vor Ort (Parken, Backstage, Strom/Bühne, Dresscode, Anfahrt)">
              <textarea
                name="gig_logistik"
                rows={4}
                value={felder.gig_logistik}
                onChange={(e) => setFeld("gig_logistik", e.target.value)}
                onBlur={autosave}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-4">
            <span className="text-xs font-medium text-slate-600">
              Ansprechpartner vor Ort
            </span>
            {/* Serialisiert die Liste für den Autosave (liest das Formular per FormData aus). */}
            <input
              type="hidden"
              name="gig_ansprechpartner"
              value={JSON.stringify(ansprechpartner)}
            />
            <div className="mt-1 flex flex-col gap-2">
              {ansprechpartner.map((partner, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr_1fr_auto]"
                >
                  <select
                    value={partner.rolle}
                    onChange={(e) =>
                      aendereAnsprechpartner(index, "rolle", e.target.value)
                    }
                    onBlur={autosave}
                    className={inputClass}
                  >
                    <option value="">- Rolle -</option>
                    {GIG_ANSPRECHPARTNER_ROLLEN.map((rolle) => (
                      <option key={rolle} value={rolle}>
                        {rolle}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Name"
                    value={partner.name}
                    onChange={(e) =>
                      aendereAnsprechpartner(index, "name", e.target.value)
                    }
                    onBlur={autosave}
                    className={inputClass}
                  />
                  <input
                    placeholder="Telefon"
                    value={partner.telefon}
                    onChange={(e) =>
                      aendereAnsprechpartner(index, "telefon", e.target.value)
                    }
                    onBlur={autosave}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAnsprechpartnerUndSpeichere(
                        ansprechpartner.filter((_, i) => i !== index)
                      )
                    }
                    className="justify-self-start rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                    aria-label="Ansprechpartner entfernen"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setAnsprechpartner((prev) => [
                  ...prev,
                  { rolle: "", name: "", telefon: "" },
                ])
              }
              className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              + Ansprechpartner hinzufügen
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-base font-medium text-slate-900">
          Band-Zuordnung
        </h2>
        <div className="flex flex-col gap-4">
          {bands.map((band) => {
            const relation = relationFor(band.id);
            const istVerknuepft = linked[band.id];
            const bandAnfrage = anfrageFuerBand(band.id);
            return (
              <div
                key={band.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 font-medium text-slate-900">
                    <input
                      type="checkbox"
                      name={`band_${band.id}_linked`}
                      defaultChecked={istVerknuepft}
                      onChange={(e) => {
                        setLinked((prev) => ({
                          ...prev,
                          [band.id]: e.target.checked,
                        }));
                        autosave();
                      }}
                    />
                    {band.name}
                  </label>
                </div>
                <div
                  className={
                    istVerknuepft
                      ? "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
                      : "hidden"
                  }
                >
                  <Field label="Status">
                    <select
                      name={`band_${band.id}_status`}
                      value={bandStatus[band.id] ?? "neu"}
                      onChange={(e) => {
                        const neu = e.target.value as Status;
                        if (neu !== bandStatus[band.id]) {
                          setLetzterKontakt((prev) => ({
                            ...prev,
                            [band.id]: new Date().toISOString(),
                          }));
                        }
                        setBandStatus((prev) => ({ ...prev, [band.id]: neu }));
                        autosave();
                      }}
                      className={inputClass}
                    >
                      {STATUS_ORDER.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nächster Follow-up">
                    <input
                      type="date"
                      name={`band_${band.id}_follow_up`}
                      defaultValue={
                        relation?.naechster_follow_up_am
                          ? format(
                              new Date(relation.naechster_follow_up_am),
                              "yyyy-MM-dd"
                            )
                          : ""
                      }
                      onBlur={autosave}
                      className={inputClass}
                    />
                  </Field>
                  <p className="text-xs text-slate-500 sm:col-span-2">
                    Letzter Kontakt:{" "}
                    {letzterKontakt[band.id]
                      ? format(new Date(letzterKontakt[band.id]!), "dd.MM.yyyy")
                      : "noch kein Kontakt"}
                  </p>
                  {bandAnfrage && (
                    <div className="sm:col-span-2">
                      <AnfrageBadge
                        anfrage={bandAnfrage}
                        gesamtMitglieder={mitgliederProBand?.[band.id] ?? 0}
                      />
                    </div>
                  )}
                  {venue && (
                    <div className="sm:col-span-2">
                      <VenueProtokoll
                        bandId={band.id}
                        venueId={venue.id}
                        eintraege={(protokoll ?? []).filter(
                          (p) => p.band_id === band.id
                        )}
                      />
                    </div>
                  )}
                  {venue && (
                    <div className="sm:col-span-2">
                      <DokumentChecklist
                        bandId={band.id}
                        venueId={venue.id}
                        dokumentTypen={dokumentTypenProBand?.[band.id] ?? []}
                        versendet={(dokumente ?? []).filter(
                          (d) => d.band_id === band.id
                        )}
                      />
                    </div>
                  )}
                  {venue && (
                    <div className="sm:col-span-2">
                      <VenueEmailThread
                        bandId={band.id}
                        bandName={band.name}
                        venueId={venue.id}
                        venueName={felder.name}
                        venueOrt={felder.ort || null}
                        venueAnsprechpartner={felder.ansprechpartner || null}
                        venueEmail={felder.email || null}
                        venueDatum={felder.veranstaltungsdatum || null}
                        vorlagen={vorlagenProBand?.[band.id] ?? []}
                        emails={(emails ?? []).filter(
                          (m) => m.band.id === band.id
                        )}
                        dokumentTypen={dokumentTypenProBand?.[band.id] ?? []}
                        materialien={materialienProBand?.[band.id] ?? []}
                        setlisten={setlistenProBand?.[band.id] ?? []}
                        hatTelefonatNachweis={(protokoll ?? []).some(
                          (p) =>
                            p.band_id === band.id &&
                            p.typ === TELEFONAT_ZUSENDUNG
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {speicherFehler && (
        <p className="text-sm text-red-600">{speicherFehler}</p>
      )}

      <div className="flex gap-3">
        {!venue && (
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Anlegen
          </button>
        )}
        {venue && (
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `"${venue.name}" wirklich unwiderruflich löschen? Das kann nicht rückgängig gemacht werden.`
                )
              ) {
                deleteVenue(venue.id);
              }
            }}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Löschen
          </button>
        )}
      </div>
      </form>
    </>
  );
}
