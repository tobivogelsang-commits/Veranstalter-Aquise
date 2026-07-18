import { VenueSucheForm } from "@/components/VenueSucheForm";
import { ALLE_BANDS_PARAM } from "@/lib/constants";

export default async function VenueSuchePage({
  searchParams,
}: {
  searchParams: Promise<{ band?: string }>;
}) {
  const { band } = await searchParams;
  const bandFilter = band ?? ALLE_BANDS_PARAM;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Neue Veranstalter finden
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sucht über SerpApi nach Locations oder Veranstaltungen. Typ optional -
          ohne Auswahl wird nach der Suche pro Treffer eine Kategorie vorgeschlagen.
        </p>
      </div>
      <VenueSucheForm bandFilter={bandFilter} />
    </div>
  );
}
