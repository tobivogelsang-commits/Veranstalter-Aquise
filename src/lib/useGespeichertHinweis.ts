"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Server Actions leiten nach dem Speichern auf `?gespeichert=1` um (da ein
// Redirect keinen Rückgabewert an den Client liefert). Dieser Hook liest das
// Signal einmalig aus, räumt den Query-Parameter wieder auf (damit ein
// Reload den Hinweis nicht erneut zeigt) und liefert ein kurzes true zurück.
export function useGespeichertHinweis() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [gespeichert] = useState(() => searchParams.get("gespeichert") === "1");

  useEffect(() => {
    if (!gespeichert) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("gespeichert");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return gespeichert;
}
