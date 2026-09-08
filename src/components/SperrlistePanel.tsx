"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { hebeSperreAuf, sperreKontakt } from "@/lib/sperrlisteActions";
import type { SperrlisteEintragMitBand } from "@/lib/sperrlisteActions";
import type { Band } from "@/lib/types";

function datum(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export function SperrlistePanel({
  venueId,
  venueName,
  venueOrt,
  venueEmail,
  bands,
  sperren,
}: {
  venueId: string;
  venueName: string;
  venueOrt: string | null;
  venueEmail: string | null;
  bands: Band[];
  sperren: SperrlisteEintragMitBand[];
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [bandId, setBandId] = useState(bands[0]?.id ?? "");
  const [grund, setGrund] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const gesperrteBandIds = new Set(sperren.map((s) => s.band_id));
  const freieBands = bands.filter((b) => !gesperrteBandIds.has(b.id));

  async function eintragen() {
    if (!bandId) return;
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await sperreKontakt(
      bandId,
      { email: venueEmail, name: venueName, ort: venueOrt },
      grund,
      venueId
    );
    setLaeuft(false);
    if (!ergebnis.ok) return setFehler(ergebnis.fehler);
    setGrund("");
    setOffen(false);
    router.refresh();
  }

  async function aufheben(sperrId: string, bandName: string | null) {
    if (
      !confirm(
        `Widerspruch für ${bandName ?? "diese Band"} aufheben? Der Kontakt darf danach wieder angeschrieben werden.`
      )
    ) {
      return;
    }
    const ergebnis = await hebeSperreAuf(sperrId);
    if (!ergebnis.ok) return setFehler(ergebnis.fehler);
    router.refresh();
  }

  return (
    <div
      className={
        sperren.length > 0
          ? "rounded-lg border border-red-300 bg-red-50 p-4"
          : "rounded-lg border border-slate-200 bg-white p-4"
      }
    >
      {sperren.length > 0 ? (
        <>
          <h2 className="text-sm font-semibold text-red-800">
            Werbewiderspruch – nicht anschreiben
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {sperren.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-red-900">
                  <strong>{s.bandName ?? "Unbekannte Band"}</strong> seit{" "}
                  {datum(s.erstellt_am)}
                  {s.grund && <span className="text-red-700"> · {s.grund}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => aufheben(s.id, s.bandName)}
                  className="shrink-0 text-xs text-red-700 underline hover:text-red-900"
                >
                  aufheben
                </button>
              </li>
            ))}
          </ul>
          {/* Der Widerspruch gilt nur fuer die Band, der er gegenueber
              geaeussert wurde - die andere darf weiterhin anfragen. Der
              Hinweis sorgt dafuer, dass man das bewusst tut und nicht
              ahnungslos hinterherlaeuft. */}
          {freieBands.length > 0 && (
            <p className="mt-2 text-xs text-red-700">
              Für {freieBands.map((b) => b.name).join(" und ")} besteht kein
              Widerspruch – dort ist eine Anfrage weiterhin möglich.
            </p>
          )}
        </>
      ) : (
        <h2 className="text-sm font-semibold text-slate-900">Werbewiderspruch</h2>
      )}

      {!offen && freieBands.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setBandId(freieBands[0].id);
            setOffen(true);
          }}
          className={`mt-3 rounded-md border px-3 py-1.5 text-xs font-medium ${
            sperren.length > 0
              ? "border-red-300 text-red-800 hover:bg-red-100"
              : "border-slate-300 text-slate-700 hover:bg-slate-100"
          }`}
        >
          Widerspruch eintragen
        </button>
      )}

      {offen && (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Band, die nicht mehr anfragen darf
            <select
              value={bandId}
              onChange={(e) => setBandId(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
            >
              {freieBands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Notiz (woher kam der Widerspruch?)
            <input
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              placeholder="z. B. telefonisch am 12.09., will keine Werbung"
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
            />
          </label>
          <p className="text-xs text-slate-500">
            Gemerkt werden {venueEmail ? `${venueEmail}, ` : ""}
            {venueName}
            {venueOrt ? ` (${venueOrt})` : ""}. Mails an diesen Kontakt werden
            dann blockiert, und die Recherche ordnet ihn dieser Band nicht mehr zu.
          </p>
          {fehler && <p className="text-xs text-red-600">{fehler}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={eintragen}
              disabled={laeuft}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {laeuft ? "Wird eingetragen…" : "Eintragen"}
            </button>
            <button
              type="button"
              onClick={() => setOffen(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
