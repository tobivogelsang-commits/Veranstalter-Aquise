"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  createVenue,
  deleteVenue,
  rechercheKontakt,
  updateStatus,
  updateVenue,
} from "@/lib/actions";
import { STATUS_LABELS, STATUS_ORDER, VENUE_TYPEN } from "@/lib/constants";
import type { Status } from "@/lib/database.types";
import type {
  Band,
  EmailVorlage,
  GigAnfrageMitAntworten,
  VenueEmailMitBand,
  VenueWithRelations,
} from "@/lib/types";
import { useGespeichertHinweis } from "@/lib/useGespeichertHinweis";
import { SpeichernToast } from "@/components/SpeichernToast";
import { AnfrageBadge } from "@/components/TeamAnfragenList";
import { VenueEmailThread } from "@/components/VenueEmailThread";

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
};

export function VenueForm({
  bands,
  venue,
  emails,
  anfragen,
  mitgliederProBand,
  vorlagenProBand,
}: {
  bands: Band[];
  venue?: VenueWithRelations;
  emails?: VenueEmailMitBand[];
  anfragen?: GigAnfrageMitAntworten[];
  mitgliederProBand?: Record<string, number>;
  vorlagenProBand?: Record<string, EmailVorlage[]>;
}) {
  const action = venue ? updateVenue.bind(null, venue.id) : createVenue;
  const gespeichert = useGespeichertHinweis();

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
  });

  function setFeld<K extends keyof FelderState>(key: K, value: FelderState[K]) {
    setFelder((prev) => ({ ...prev, [key]: value }));
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

  return (
    <>
      <SpeichernToast show={gespeichert} />
      <form action={action} className="flex max-w-2xl flex-col gap-6">
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
            className={inputClass}
          />
        </Field>
        <Field label="Veranstaltungsdatum">
          <input
            type="date"
            name="veranstaltungsdatum"
            value={felder.veranstaltungsdatum}
            onChange={(e) => setFeld("veranstaltungsdatum", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Typ">
          <select
            name="typ"
            value={felder.typ}
            onChange={(e) => setFeld("typ", e.target.value)}
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
            className={inputClass}
          />
        </Field>
        <Field label="Region">
          <input
            name="region"
            value={felder.region}
            onChange={(e) => setFeld("region", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Straße/Hausnummer">
          <input
            name="strasse"
            value={felder.strasse}
            onChange={(e) => setFeld("strasse", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Website">
          <input
            name="website"
            value={felder.website}
            onChange={(e) => setFeld("website", e.target.value)}
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
            className={inputClass}
          />
        </Field>
        <Field label="E-Mail">
          <input
            name="email"
            type="email"
            value={felder.email}
            onChange={(e) => setFeld("email", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Telefon">
          <input
            name="telefon"
            value={felder.telefon}
            onChange={(e) => setFeld("telefon", e.target.value)}
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
          className={inputClass}
        />
      </Field>

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
                      onChange={(e) =>
                        setLinked((prev) => ({
                          ...prev,
                          [band.id]: e.target.checked,
                        }))
                      }
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
                      onChange={(e) =>
                        setBandStatus((prev) => ({
                          ...prev,
                          [band.id]: e.target.value as Status,
                        }))
                      }
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
                      <VenueEmailThread
                        bandId={band.id}
                        bandName={band.name}
                        venueId={venue.id}
                        venueName={felder.name}
                        venueOrt={felder.ort || null}
                        venueAnsprechpartner={felder.ansprechpartner || null}
                        venueEmail={felder.email || null}
                        vorlagen={vorlagenProBand?.[band.id] ?? []}
                        emails={(emails ?? []).filter(
                          (m) => m.band.id === band.id
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

      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Speichern
        </button>
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
