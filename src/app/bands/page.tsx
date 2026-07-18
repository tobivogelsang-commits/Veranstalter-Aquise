import Link from "next/link";
import { getBands } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function BandsPage() {
  const bands = await getBands();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Bands</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stammdaten und Materialien (Stage Rider, EPK, YouTube, ...) pro Band.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {bands.map((band) => (
          <Link
            key={band.id}
            href={`/bands/${band.id}`}
            className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm"
          >
            <p className="font-medium text-slate-900">{band.name}</p>
            {band.genre && <p className="text-sm text-slate-500">{band.genre}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
