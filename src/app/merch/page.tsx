import Link from "next/link";
import { getBands, getMerchNachbestellProBand } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MerchPage() {
  const [bands, nachbestellProBand] = await Promise.all([
    getBands(),
    getMerchNachbestellProBand(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Merch</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lagerbestand und Design-Vorlagen - jede Band hat ihr eigenes Lager.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {bands.map((band) => {
          const nachbestellen = nachbestellProBand[band.id] ?? 0;
          return (
            <Link
              key={band.id}
              href={`/merch/${band.id}`}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-900">{band.name}</p>
                {/* Zeigt nach dem Dashboard-Hinweis, welche Band gemeint ist. */}
                {nachbestellen > 0 && (
                  <span
                    className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white"
                    title={`${nachbestellen} Artikel nachbestellen`}
                  >
                    {nachbestellen}
                  </span>
                )}
              </div>
              {band.genre && <p className="text-sm text-slate-500">{band.genre}</p>}
              {nachbestellen > 0 && (
                <p className="mt-1 text-sm font-medium text-amber-700">
                  {nachbestellen === 1
                    ? "1 Artikel nachbestellen"
                    : `${nachbestellen} Artikel nachbestellen`}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
