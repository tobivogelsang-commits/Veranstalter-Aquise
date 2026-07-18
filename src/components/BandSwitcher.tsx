"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ALLE_BANDS_PARAM } from "@/lib/constants";
import type { Band } from "@/lib/types";
import clsx from "clsx";

export function BandSwitcher({ bands }: { bands: Band[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const aktuelleBand = searchParams.get("band") ?? ALLE_BANDS_PARAM;

  function waehleBand(bandId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (bandId === ALLE_BANDS_PARAM) {
      params.delete("band");
    } else {
      params.set("band", bandId);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const tabs = [{ id: ALLE_BANDS_PARAM, name: "Beide" }, ...bands];

  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => waehleBand(tab.id)}
          className={clsx(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            aktuelleBand === tab.id
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          {tab.name}
        </button>
      ))}
    </div>
  );
}
