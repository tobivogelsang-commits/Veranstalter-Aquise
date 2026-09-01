import Link from "next/link";
import clsx from "clsx";
import { BandSwitcher } from "@/components/BandSwitcher";
import { BelegePanel } from "@/components/BelegePanel";
import { NeueRechnungButton } from "@/components/NeueRechnungButton";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import {
  berechneAngebotSummen,
  formatDatumLang,
  formatEuro,
} from "@/lib/angebotHelpers";
import {
  getBands,
  getBelege,
  getOffeneGagenAnteile,
  getRechnungen,
} from "@/lib/queries";
import { getMitgliederFuerBand } from "@/lib/teamActions";
import { requireFreigabeSeite } from "@/lib/authServer";
import type { RechnungStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<RechnungStatus, string> = {
  entwurf: "Entwurf",
  versendet: "Offen",
  bezahlt: "Bezahlt",
  storniert: "Storniert",
};

const STATUS_FARBE: Record<RechnungStatus, string> = {
  entwurf: "bg-slate-100 text-slate-700",
  versendet: "bg-amber-100 text-amber-800",
  bezahlt: "bg-green-100 text-green-800",
  storniert: "bg-red-100 text-red-700",
};

function SummenKarte({
  label,
  wert,
  betont,
}: {
  label: string;
  wert: string;
  betont?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={clsx(
          "mt-1 text-2xl font-semibold",
          betont ? "text-slate-900" : "text-slate-700"
        )}
      >
        {wert}
      </p>
    </div>
  );
}

export default async function BuchhaltungPage({
  searchParams,
}: {
  searchParams: Promise<{ band?: string; jahr?: string }>;
}) {
  await requireFreigabeSeite("buchhaltung_ansehen");
  const { band, jahr } = await searchParams;
  const bandFilter = band ?? ALLE_BANDS_PARAM;
  const aktuellesJahr = new Date().getFullYear();
  const jahrFilter = Number(jahr) || aktuellesJahr;

  const [bands, alleRechnungen, alleBelege, offeneGagen] = await Promise.all([
    getBands(),
    getRechnungen(),
    getBelege(),
    getOffeneGagenAnteile(),
  ]);
  const mitgliederListen = await Promise.all(
    bands.map((b) => getMitgliederFuerBand(b.id))
  );
  const mitgliederProBand = Object.fromEntries(
    bands.map((b, i) => [
      b.id,
      mitgliederListen[i].map((m) => ({ id: m.id, name: m.name })),
    ])
  );

  const passtZurBand = (bandId: string) =>
    bandFilter === ALLE_BANDS_PARAM || bandId === bandFilter;

  const rechnungen = alleRechnungen.filter(
    (r) => passtZurBand(r.band_id) && new Date(r.datum).getFullYear() === jahrFilter
  );
  const belege = alleBelege.filter(
    (b) => passtZurBand(b.band_id) && new Date(b.datum).getFullYear() === jahrFilter
  );
  const gagen = offeneGagen.filter((g) => passtZurBand(g.band_id));

  // Vorhandene Jahre für den Filter (mindestens das aktuelle).
  const jahre = Array.from(
    new Set([
      aktuellesJahr,
      ...alleRechnungen.map((r) => new Date(r.datum).getFullYear()),
      ...alleBelege.map((b) => new Date(b.datum).getFullYear()),
    ])
  ).sort((a, b) => b - a);

  const brutto = (r: (typeof rechnungen)[number]) =>
    berechneAngebotSummen(r.positionen, r.ust_satz).brutto;

  // Stornierte Originale UND ihre negativen Stornorechnungen zählen beide -
  // sie heben sich gegenseitig auf, die Summe stimmt also ohne Sonderfälle.
  const gestellt = rechnungen
    .filter((r) => r.status !== "entwurf")
    .reduce((summe, r) => summe + brutto(r), 0);
  const bezahlt = rechnungen
    .filter((r) => r.status === "bezahlt")
    .reduce((summe, r) => summe + brutto(r), 0);
  const ausgaben = belege.reduce((summe, b) => summe + Number(b.betrag), 0);
  const heute = new Date().toISOString().slice(0, 10);

  const exportQuery = `?band=${encodeURIComponent(bandFilter)}&jahr=${jahrFilter}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Buchhaltung</h1>
          <p className="mt-1 text-sm text-slate-500">
            Rechnungen, Belege und Gagen – pro Band und Jahr.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BandSwitcher bands={bands} />
            <div className="flex gap-1">
              {jahre.map((j) => (
                <Link
                  key={j}
                  href={`/buchhaltung?band=${encodeURIComponent(bandFilter)}&jahr=${j}`}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-sm",
                    j === jahrFilter
                      ? "bg-slate-900 font-medium text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  )}
                >
                  {j}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <NeueRechnungButton bands={bands} bandFilter={bandFilter} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummenKarte label="In Rechnung gestellt" wert={formatEuro(gestellt)} />
        <SummenKarte label="Davon bezahlt" wert={formatEuro(bezahlt)} />
        <SummenKarte label="Ausgaben (Belege)" wert={formatEuro(ausgaben)} />
        <SummenKarte
          label="Ergebnis (bezahlt − Ausgaben)"
          wert={formatEuro(bezahlt - ausgaben)}
          betont
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-900">Rechnungen</h2>
          <a
            href={`/api/buchhaltung/export${exportQuery}`}
            className="text-xs text-slate-500 underline hover:text-slate-900"
          >
            CSV für den Steuerberater
          </a>
        </div>
        {rechnungen.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            Noch keine Rechnungen in {jahrFilter}. Über „+ Neue Rechnung“ oder
            aus einem Angebot heraus („In Rechnung umwandeln“) anlegen.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Nummer</th>
                  <th className="px-4 py-2 font-medium">Empfänger</th>
                  <th className="px-4 py-2 font-medium">Band</th>
                  <th className="px-4 py-2 font-medium">Datum</th>
                  <th className="px-4 py-2 text-right font-medium">Betrag</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rechnungen.map((r) => {
                  const ueberfaellig =
                    r.status === "versendet" &&
                    Boolean(r.faellig_am) &&
                    (r.faellig_am as string) < heute;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/buchhaltung/rechnung/${r.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {r.nummer}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.empfaenger_name || "–"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.band.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDatumLang(r.datum)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatEuro(brutto(r))}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            "rounded px-2 py-0.5 text-xs font-medium",
                            ueberfaellig
                              ? "bg-red-100 text-red-700"
                              : STATUS_FARBE[r.status]
                          )}
                        >
                          {ueberfaellig ? "Überfällig" : STATUS_LABEL[r.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {gagen.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-medium text-amber-900">
            Offene Auszahlungen
          </h2>
          <ul className="flex flex-col gap-1 text-sm text-amber-900">
            {gagen.map((g) => (
              <li key={g.id} className="flex justify-between gap-3">
                <span>
                  {g.mitglied_name} · {g.rechnung.nummer}
                </span>
                <span className="font-medium">{formatEuro(Number(g.betrag))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BelegePanel
        bands={bands}
        vorgewaehlteBandId={bandFilter === ALLE_BANDS_PARAM ? null : bandFilter}
        mitgliederProBand={mitgliederProBand}
        belege={belege}
      />

      <p className="text-xs text-slate-400">
        Jahres-Export:{" "}
        <a
          href={`/api/buchhaltung/export${exportQuery}`}
          className="underline hover:text-slate-600"
        >
          Rechnungs- & Beleg-Liste (CSV)
        </a>{" "}
        ·{" "}
        <a
          href={`/api/buchhaltung/belege-zip${exportQuery}`}
          className="underline hover:text-slate-600"
        >
          alle Beleg-Dateien (ZIP)
        </a>
      </p>
    </div>
  );
}
