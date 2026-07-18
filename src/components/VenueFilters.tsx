"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STATUS_LABELS, STATUS_ORDER, VENUE_TYPEN } from "@/lib/constants";

export function VenueFilters({ regionen }: { regionen: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [suche, setSuche] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (suche !== (searchParams.get("q") ?? "")) setParam("q", suche);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suche]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <input
        type="text"
        placeholder="Suche nach Name..."
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-56"
      />
      <select
        defaultValue={searchParams.get("typ") ?? ""}
        onChange={(e) => setParam("typ", e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      >
        <option value="">Alle Typen</option>
        {VENUE_TYPEN.map((typ) => (
          <option key={typ} value={typ}>
            {typ}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("region") ?? ""}
        onChange={(e) => setParam("region", e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      >
        <option value="">Alle Regionen</option>
        {regionen.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      >
        <option value="">Alle Status</option>
        {STATUS_ORDER.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
}
