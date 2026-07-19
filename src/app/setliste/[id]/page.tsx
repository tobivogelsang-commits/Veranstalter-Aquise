import { notFound } from "next/navigation";
import { SetlisteBuilder } from "@/components/SetlisteBuilder";
import { getBands, getBandSongs, getSetlistenMitSongs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SetlisteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bands, songs, setlisten] = await Promise.all([
    getBands(),
    getBandSongs(id),
    getSetlistenMitSongs(id),
  ]);

  const band = bands.find((b) => b.id === id);
  if (!band) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Setliste: {band.name}
        </h1>
      </div>
      <SetlisteBuilder bandId={band.id} initialSongs={songs} initialSetlisten={setlisten} />
    </div>
  );
}
