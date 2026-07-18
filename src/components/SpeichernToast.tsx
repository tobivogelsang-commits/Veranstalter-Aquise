"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export function SpeichernToast({ show }: { show: boolean }) {
  const [sichtbar, setSichtbar] = useState(show);

  useEffect(() => {
    if (!show) return;
    const timeout = setTimeout(() => setSichtbar(false), 2500);
    return () => clearTimeout(timeout);
  }, [show]);

  return (
    <div
      aria-live="polite"
      className={clsx(
        "fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-opacity duration-300",
        sichtbar ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      ✓ Gespeichert
    </div>
  );
}
