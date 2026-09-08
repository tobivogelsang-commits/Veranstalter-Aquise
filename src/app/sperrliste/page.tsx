import Link from "next/link";
import { SperrlisteVerwaltung } from "@/components/SperrlisteVerwaltung";
import { holeSperrliste } from "@/lib/sperrlisteActions";
import { getBands } from "@/lib/queries";
import { requireFreigabeSeite } from "@/lib/authServer";

export const dynamic = "force-dynamic";

export default async function SperrlistePage() {
  await requireFreigabeSeite("akquise");
  const [eintraege, bands] = await Promise.all([holeSperrliste(), getBands()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sperrliste</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Kontakte, die der Werbung widersprochen haben (DSGVO Art. 21). An diese
          Adressen wird keine Mail mehr versendet, und die Veranstalter-Suche
          ordnet sie der betroffenen Band nicht mehr zu. Ein Widerspruch gilt nur
          für die Band, der gegenüber er geäußert wurde – bei einem Kontakt sieht
          man aber, wenn eine andere Band dort abgewiesen wurde.
        </p>
        <Link href="/venues" className="mt-2 inline-block text-sm text-slate-600 underline">
          ← Zu den Veranstaltern
        </Link>
      </div>
      <SperrlisteVerwaltung eintraege={eintraege} bands={bands} />
    </div>
  );
}
