import { notFound } from "next/navigation";
import { DruckAusloeser } from "@/components/DruckAusloeser";
import { formatDauer, summeDauer } from "@/lib/dauer";
import { getSetlisteMitBand, getSetlistSongs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DruckansichtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [setliste, songs] = await Promise.all([
    getSetlisteMitBand(id),
    getSetlistSongs(id),
  ]);

  if (!setliste) notFound();

  return (
    <div className="mx-auto max-w-md py-8">
      <DruckAusloeser />
      <h1 className="text-center text-3xl font-medium text-slate-900">
        {setliste.band.name}
      </h1>
      <p className="mb-8 text-center text-base text-slate-500">{setliste.name}</p>
      <ol className="flex flex-col gap-3">
        {songs.map((song, index) => (
          <li
            key={song.id}
            className="flex items-baseline gap-3 border-b border-slate-200 pb-2"
          >
            <span className="w-6 text-lg text-slate-400">{index + 1}</span>
            <span className="flex-1 text-xl text-slate-900">{song.titel}</span>
          </li>
        ))}
        {songs.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            Diese Setliste enthält noch keine Songs.
          </p>
        )}
      </ol>
      <p className="mt-8 text-center text-xs text-slate-400">
        Gesamtdauer {formatDauer(summeDauer(songs.map((s) => s.dauer_sekunden)))}
      </p>
    </div>
  );
}
