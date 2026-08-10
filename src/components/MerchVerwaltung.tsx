"use client";

import { useRef, useState } from "react";
import { MerchBestandsListe, istKnapp } from "@/components/MerchBestandsListe";
import {
  aktualisiereMerchArtikel,
  erstelleMerchArtikel,
  ladeMerchVorlageHoch,
  loescheMerchArtikel,
  loescheMerchVorlage,
} from "@/lib/merchActions";
import { MERCH_GROESSEN, MERCH_KATEGORIEN } from "@/lib/constants";
import type { MerchArtikel, MerchVorlageMitUrl } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none";

const leeresFormular = {
  kategorie: MERCH_KATEGORIEN[0],
  name: "",
  variante: "",
  bestand: "0",
  mindestbestand: "0",
};

// Desktop-Verwaltung des Merch-Lagers: Bestand pflegen, Artikel anlegen/
// bearbeiten/löschen, Nachbestell-Übersicht und Design-/Druckvorlagen.
export function MerchVerwaltung({
  bandId,
  initialArtikel,
  initialVorlagen,
}: {
  bandId: string;
  initialArtikel: MerchArtikel[];
  initialVorlagen: MerchVorlageMitUrl[];
}) {
  const [artikel, setArtikel] = useState<MerchArtikel[]>(initialArtikel);
  const [vorlagen, setVorlagen] = useState<MerchVorlageMitUrl[]>(initialVorlagen);
  const [form, setForm] = useState(leeresFormular);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const [vorlageTitel, setVorlageTitel] = useState("");
  const [vorlageArtikelId, setVorlageArtikelId] = useState("");
  const [vorlageFehler, setVorlageFehler] = useState<string | null>(null);
  const [vorlageLaeuft, setVorlageLaeuft] = useState(false);
  const dateiRef = useRef<HTMLInputElement>(null);

  const knapp = artikel.filter(istKnapp);

  function sortiert(liste: MerchArtikel[]): MerchArtikel[] {
    return [...liste].sort(
      (a, b) =>
        a.kategorie.localeCompare(b.kategorie) ||
        a.name.localeCompare(b.name) ||
        a.variante.localeCompare(b.variante)
    );
  }

  function handleBestand(artikelId: string, bestand: number) {
    setArtikel((prev) => prev.map((a) => (a.id === artikelId ? { ...a, bestand } : a)));
  }

  async function handleSpeichern() {
    if (!form.name.trim() || laeuft) return;
    setLaeuft(true);
    setFehler(null);

    const werte = {
      kategorie: form.kategorie,
      name: form.name,
      variante: form.variante,
      mindestbestand: Number(form.mindestbestand) || 0,
    };

    const ergebnis = bearbeiteId
      ? await aktualisiereMerchArtikel(bearbeiteId, bandId, werte)
      : await erstelleMerchArtikel(bandId, {
          ...werte,
          bestand: Number(form.bestand) || 0,
        });
    setLaeuft(false);

    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    setArtikel((prev) =>
      sortiert(
        bearbeiteId
          ? prev.map((a) => (a.id === bearbeiteId ? ergebnis.artikel : a))
          : [...prev, ergebnis.artikel]
      )
    );
    setForm(leeresFormular);
    setBearbeiteId(null);
  }

  function starteBearbeiten(a: MerchArtikel) {
    setBearbeiteId(a.id);
    setFehler(null);
    setForm({
      kategorie: a.kategorie,
      name: a.name,
      variante: a.variante,
      bestand: String(a.bestand),
      mindestbestand: String(a.mindestbestand),
    });
  }

  async function handleLoeschen(a: MerchArtikel) {
    if (!confirm(`"${a.name}${a.variante ? ` (${a.variante})` : ""}" wirklich löschen?`))
      return;
    const ergebnis = await loescheMerchArtikel(a.id, bandId);
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    setArtikel((prev) => prev.filter((x) => x.id !== a.id));
    if (bearbeiteId === a.id) {
      setBearbeiteId(null);
      setForm(leeresFormular);
    }
  }

  async function handleVorlageHochladen() {
    const datei = dateiRef.current?.files?.[0];
    if (vorlageLaeuft) return;
    // Ohne Rückmeldung wirkt der Knopf kaputt, wenn noch keine Datei gewählt ist.
    if (!datei) {
      setVorlageFehler("Bitte zuerst eine Datei auswählen.");
      return;
    }
    setVorlageLaeuft(true);
    setVorlageFehler(null);

    const formData = new FormData();
    formData.set("datei", datei);
    formData.set("titel", vorlageTitel);
    formData.set("artikelId", vorlageArtikelId);

    const ergebnis = await ladeMerchVorlageHoch(bandId, formData);
    setVorlageLaeuft(false);
    if (!ergebnis.ok) {
      setVorlageFehler(ergebnis.fehler);
      return;
    }
    // Signierte URLs entstehen serverseitig - nach dem Upload neu laden.
    setVorlageTitel("");
    setVorlageArtikelId("");
    if (dateiRef.current) dateiRef.current.value = "";
    window.location.reload();
  }

  async function handleVorlageLoeschen(vorlage: MerchVorlageMitUrl) {
    if (!confirm(`Vorlage "${vorlage.titel || vorlage.dateiname}" wirklich löschen?`))
      return;
    const ergebnis = await loescheMerchVorlage(vorlage.id, bandId);
    if (!ergebnis.ok) {
      setVorlageFehler(ergebnis.fehler);
      return;
    }
    setVorlagen((prev) => prev.filter((v) => v.id !== vorlage.id));
  }

  function artikelLabel(a: MerchArtikel): string {
    return `${a.name}${a.variante ? ` (${a.variante})` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      {knapp.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Nachbestellen ({knapp.length})
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {knapp.map((a) => (
              <li key={a.id} className="text-sm text-amber-800">
                {artikelLabel(a)} — noch {a.bestand}, Mindestbestand {a.mindestbestand}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-900">
            Bestand ({artikel.length})
          </h2>
          <MerchBestandsListe
            bandId={bandId}
            artikel={artikel}
            onBestandGeaendert={handleBestand}
            onBearbeiten={starteBearbeiten}
            onLoeschen={handleLoeschen}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-900">
            {bearbeiteId ? "Artikel bearbeiten" : "Neuer Artikel"}
          </h2>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Kategorie
              <select
                value={form.kategorie}
                onChange={(e) => setForm((p) => ({ ...p, kategorie: e.target.value }))}
                className={inputClass}
              >
                {MERCH_KATEGORIEN.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Bezeichnung
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="z. B. T-Shirt Logo schwarz"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Variante / Größe (optional)
              <input
                value={form.variante}
                onChange={(e) => setForm((p) => ({ ...p, variante: e.target.value }))}
                placeholder="z. B. L"
                list="merch-groessen"
                className={inputClass}
              />
              <datalist id="merch-groessen">
                {MERCH_GROESSEN.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </label>

            <div className="flex gap-2">
              {!bearbeiteId && (
                <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
                  Bestand
                  <input
                    type="number"
                    min="0"
                    value={form.bestand}
                    onChange={(e) => setForm((p) => ({ ...p, bestand: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              )}
              <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
                Mindestbestand
                <input
                  type="number"
                  min="0"
                  value={form.mindestbestand}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, mindestbestand: e.target.value }))
                  }
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSpeichern}
                disabled={laeuft}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {bearbeiteId ? "Speichern" : "+ Artikel"}
              </button>
              {bearbeiteId && (
                <button
                  type="button"
                  onClick={() => {
                    setBearbeiteId(null);
                    setForm(leeresFormular);
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Abbrechen
                </button>
              )}
            </div>
            {fehler && <p className="text-xs text-red-600">{fehler}</p>}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-medium text-slate-900">
          Vorlagen &amp; Designs ({vorlagen.length})
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          T-Shirt-Motive, CD-Cover, Sticker-Dateien. Bilder werden als Vorschau
          angezeigt, alle Dateien lassen sich herunterladen.
        </p>

        {vorlagen.length > 0 && (
          <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {vorlagen.map((v) => {
              const zugeordnet = artikel.find((a) => a.id === v.artikel_id);
              return (
                <li
                  key={v.id}
                  className="flex flex-col gap-1 rounded-md border border-slate-200 p-2"
                >
                  {v.ist_bild && v.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.url}
                      alt={v.titel || v.dateiname}
                      className="h-28 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center rounded bg-slate-100 text-3xl">
                      📄
                    </div>
                  )}
                  <p className="truncate text-xs font-medium text-slate-900">
                    {v.titel || v.dateiname}
                  </p>
                  {zugeordnet && (
                    <p className="truncate text-[11px] text-slate-500">
                      {artikelLabel(zugeordnet)}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    {v.url ? (
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-600 underline hover:text-slate-900"
                      >
                        öffnen
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">nicht verfügbar</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleVorlageLoeschen(v)}
                      className="text-slate-300 hover:text-red-600"
                      title="Vorlage löschen"
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
            Titel (optional)
            <input
              value={vorlageTitel}
              onChange={(e) => setVorlageTitel(e.target.value)}
              placeholder="z. B. Cover Album 2026"
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
            Artikel (optional)
            <select
              value={vorlageArtikelId}
              onChange={(e) => setVorlageArtikelId(e.target.value)}
              className={inputClass}
            >
              <option value="">– keinem Artikel zugeordnet –</option>
              {artikel.map((a) => (
                <option key={a.id} value={a.id}>
                  {artikelLabel(a)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
            Datei
            <input ref={dateiRef} type="file" className="text-sm" />
          </label>
          <button
            type="button"
            onClick={handleVorlageHochladen}
            disabled={vorlageLaeuft}
            className="shrink-0 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {vorlageLaeuft ? "Lädt…" : "Hochladen"}
          </button>
        </div>
        {vorlageFehler && <p className="mt-2 text-xs text-red-600">{vorlageFehler}</p>}
      </div>
    </div>
  );
}
