"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addBandMaterial, deleteBandMaterial, updateBand } from "@/lib/actions";
import { EmailEinstellungenPanel } from "@/components/EmailEinstellungenPanel";
import { SpeichernToast } from "@/components/SpeichernToast";
import { TeamEinladung } from "@/components/TeamEinladung";
import { BAND_MATERIAL_TYPEN } from "@/lib/constants";
import { useGespeichertHinweis } from "@/lib/useGespeichertHinweis";
import type {
  BandMitgliedOhnePush,
  BandWithMaterialien,
  EmailEinstellungenOhnePasswort,
  EmailVorlage,
} from "@/lib/types";

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

export function BandForm({
  band,
  emailEinstellungen,
  teamInviteUrl,
  teamQrCodeDataUrl,
  teamMitglieder,
  emailVorlagen,
}: {
  band: BandWithMaterialien;
  emailEinstellungen: EmailEinstellungenOhnePasswort;
  teamInviteUrl: string;
  teamQrCodeDataUrl: string;
  teamMitglieder: BandMitgliedOhnePush[];
  emailVorlagen: EmailVorlage[];
}) {
  const router = useRouter();
  const action = updateBand.bind(null, band.id);
  const gespeichert = useGespeichertHinweis();

  const [neu, setNeu] = useState({
    titel: "",
    url: "",
    typ: BAND_MATERIAL_TYPEN[0],
  });
  const [hinzufuegenLaeuft, setHinzufuegenLaeuft] = useState(false);
  const [loeschenLaeuft, setLoeschenLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function handleHinzufuegen(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setHinzufuegenLaeuft(true);
    try {
      await addBandMaterial(band.id, neu.titel, neu.url, neu.typ);
      setNeu({ titel: "", url: "", typ: BAND_MATERIAL_TYPEN[0] });
      router.refresh();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Fehler beim Hinzufügen.");
    } finally {
      setHinzufuegenLaeuft(false);
    }
  }

  async function handleLoeschen(materialId: string) {
    setLoeschenLaeuft(materialId);
    try {
      await deleteBandMaterial(materialId, band.id);
      router.refresh();
    } finally {
      setLoeschenLaeuft(null);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <SpeichernToast show={gespeichert} />
      <form action={action} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name *">
            <input
              name="name"
              required
              defaultValue={band.name}
              className={inputClass}
            />
          </Field>
          <Field label="Genre">
            <input
              name="genre"
              defaultValue={band.genre ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Gagenrahmen von (€)">
            <input
              name="gagenrahmen_min"
              type="number"
              min={0}
              defaultValue={band.gagenrahmen_min ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Gagenrahmen bis (€)">
            <input
              name="gagenrahmen_max"
              type="number"
              min={0}
              defaultValue={band.gagenrahmen_max ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Kontakt-E-Mail">
            <input
              name="kontakt_email"
              type="email"
              defaultValue={band.kontakt_email ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="EPK-Link">
            <input
              name="epk_link"
              defaultValue={band.epk_link ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
        <div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Speichern
          </button>
        </div>
      </form>

      <TeamEinladung
        bandId={band.id}
        inviteUrl={teamInviteUrl}
        qrCodeDataUrl={teamQrCodeDataUrl}
        mitglieder={teamMitglieder}
      />

      <EmailEinstellungenPanel
        bandId={band.id}
        einstellungen={emailEinstellungen}
        vorlagen={emailVorlagen}
      />

      <div>
        <h2 className="mb-2 text-base font-medium text-slate-900">
          Materialien
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Stage Rider, EPK, YouTube-Links, Fotos etc. - als Titel + Link
          hinzufügen.
        </p>

        {band.band_materialien.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {band.band_materialien.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {m.titel}
                    {m.typ && (
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        ({m.typ})
                      </span>
                    )}
                  </p>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-slate-500 underline"
                  >
                    {m.url}
                  </a>
                </div>
                <button
                  type="button"
                  disabled={loeschenLaeuft === m.id}
                  onClick={() => handleLoeschen(m.id)}
                  className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={handleHinzufuegen}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <Field label="Titel">
            <input
              required
              value={neu.titel}
              onChange={(e) =>
                setNeu((prev) => ({ ...prev, titel: e.target.value }))
              }
              placeholder="z. B. Stage Rider 2026"
              className={inputClass}
            />
          </Field>
          <Field label="Link">
            <input
              required
              value={neu.url}
              onChange={(e) =>
                setNeu((prev) => ({ ...prev, url: e.target.value }))
              }
              placeholder="https://..."
              className={inputClass}
            />
          </Field>
          <Field label="Typ">
            <select
              value={neu.typ}
              onChange={(e) =>
                setNeu((prev) => ({ ...prev, typ: e.target.value }))
              }
              className={inputClass}
            >
              {BAND_MATERIAL_TYPEN.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="submit"
            disabled={hinzufuegenLaeuft}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {hinzufuegenLaeuft ? "Wird hinzugefügt…" : "Hinzufügen"}
          </button>
        </form>
        {fehler && <p className="mt-2 text-sm text-red-600">{fehler}</p>}
      </div>
    </div>
  );
}
