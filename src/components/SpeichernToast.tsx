"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

// `trigger` statt eines einfachen booleans, damit der Hinweis bei jedem neuen
// Speichervorgang erneut aufblitzt (z. B. bei Autosave, wo derselbe "true"-
// Zustand sonst mehrfach hintereinander keinen neuen Effekt auslösen würde).
// Der `key={trigger}` auf Toast sorgt für einen frischen Mount pro
// Speichervorgang, statt sichtbar per Effekt synchron zu setzen.
export function SpeichernToast({ trigger }: { trigger: number }) {
  if (trigger === 0) return null;
  return <Toast key={trigger} />;
}

function Toast() {
  const [sichtbar, setSichtbar] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setSichtbar(false), 2500);
    return () => clearTimeout(timeout);
  }, []);

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
