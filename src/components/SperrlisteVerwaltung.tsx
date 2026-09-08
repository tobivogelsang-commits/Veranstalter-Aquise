"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hebeSperreAuf, sperreKontakt } from "@/lib/sperrlisteActions";
import type { SperrlisteEintragMitBand } from "@/lib/sperrlisteActions";
import type { Band } from "@/lib/types";

function datum(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export function SperrlisteVerwaltung({
  eintraege,
  bands,
}: {
  eintraege: SperrlisteEintragMitBand[];
  bands: Band[];
}) {
  const router = useRouter();
  const [bandId, setBandId] = useState(bands[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ort, setOrt] = useState("");
  const [grund, setGrund] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function eintragen() {
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await sperreKontakt(bandId, { email, name, ort }, grund);
    setLaeuft(false);
    if (!ergebnis.ok) return setFehler(ergebnis.fehler);
    setEmail("");
    setName("");
    setOrt("");
    setGrund("");
    router.refresh();
  }

  async function aufheben(eintrag: SperrlisteEintragMitBand) {
    const wen = eintrag.email ?? eintrag.name ?? "diesen Kontakt";
    if (!confirm(`Widerspruch für ${wen} aufheben? Danach darf wieder angeschrieben werden.`)) {
      return;
    }
    const ergebnis = await hebeSperreAuf(eintrag.id);
    if (!ergebnis.ok) return setFehler(ergebnis.fehler);
    router.refresh();
  }

  const feldKlasse =
    "rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900";

  return (
    <div className="flex flex-col gap-6">
      {/* Von Hand eintragen: Ein Widerspruch kommt oft telefonisch, von jemandem
          der gar nicht in der Veranstalter-Datenbank steht. Ohne diesen Weg
          muesste man den Kontakt erst anlegen, um ihn sperren zu koennen. */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Widerspruch von Hand eintragen
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Band
            <select value={bandId} onChange={(e) => setBandId(e.target.value)} className={feldKlasse}>
              {bands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            E-Mail
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@beispiel.de"
              className={feldKlasse}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Stadthalle Musterstadt"
              className={feldKlasse}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Ort
            <input
              value={ort}
              onChange={(e) => setOrt(e.target.value)}
              placeholder="Musterstadt"
              className={feldKlasse}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Notiz
          <input
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            placeholder="z. B. telefonisch am 12.09., will keine Werbung"
            className={feldKlasse}
          />
        </label>
        <p className="text-xs text-slate-500">
          E-Mail <em>oder</em> Name genügt. Der Ort hilft, gleichnamige Häuser
          auseinanderzuhalten &ndash; &bdquo;Stadthalle&ldquo; gibt es oft.
        </p>
        {fehler && <p className="text-xs text-red-600">{fehler}</p>}
        <div>
          <button
            type="button"
            onClick={eintragen}
            disabled={laeuft || (!email.trim() && !name.trim())}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {laeuft ? "Wird eingetragen…" : "Eintragen"}
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Eingetragene Widersprüche ({eintraege.length})
        </h2>
        {eintraege.length === 0 ? (
          <p className="text-sm text-slate-500">
            Noch keine Widersprüche eingetragen.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {eintraege.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
                    {e.bandName ?? "?"}
                  </span>
                  <span className="text-slate-900">{e.email ?? e.name}</span>
                  {e.email && e.name && (
                    <span className="text-xs text-slate-500">{e.name}</span>
                  )}
                  {e.ort && <span className="text-xs text-slate-400">{e.ort}</span>}
                  <span className="text-xs text-slate-400">seit {datum(e.erstellt_am)}</span>
                </div>
                {e.grund && <p className="text-xs text-slate-500">{e.grund}</p>}
                <div className="flex gap-3">
                  {e.venue_id && (
                    <Link
                      href={`/venues/${e.venue_id}`}
                      className="text-xs text-slate-600 underline"
                    >
                      zum Veranstalter
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => aufheben(e)}
                    className="text-xs text-red-600 underline hover:text-red-800"
                  >
                    aufheben
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
