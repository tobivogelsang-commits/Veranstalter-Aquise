"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loescheAngebot } from "@/lib/angebotActions";

function PapierkorbIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

// Angebot aus der Übersicht löschen. Die Aktion leitet aus dem Editor heraus
// auf /angebote um; hier sind wir schon dort, deshalb nur neu laden.
export function AngebotLoeschenKnopf({
  angebotId,
  nummer,
}: {
  angebotId: string;
  nummer: string;
}) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);

  async function handleLoeschen() {
    if (laeuft) return;
    if (!confirm(`Angebot ${nummer} wirklich löschen? Das PDF wird mit entfernt.`))
      return;

    setLaeuft(true);
    try {
      const ergebnis = await loescheAngebot(angebotId);
      if (ergebnis && !ergebnis.ok) {
        alert(`Löschen fehlgeschlagen: ${ergebnis.fehler}`);
        setLaeuft(false);
        return;
      }
    } catch (err) {
      // Der Redirect der Aktion wirft intern - durchreichen, nicht melden.
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
      alert("Löschen fehlgeschlagen.");
      setLaeuft(false);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLoeschen}
      disabled={laeuft}
      className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      title={`Angebot ${nummer} löschen`}
      aria-label={`Angebot ${nummer} löschen`}
    >
      <PapierkorbIcon />
    </button>
  );
}
