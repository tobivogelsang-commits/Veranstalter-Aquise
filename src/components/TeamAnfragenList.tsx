import type { GigAnfrageMitAntworten } from "@/lib/types";

export function AnfrageBadge({
  anfrage,
  gesamtMitglieder,
}: {
  anfrage: GigAnfrageMitAntworten;
  gesamtMitglieder: number;
}) {
  if (anfrage.status === "bestaetigt") {
    return (
      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        ✓ Alle bestätigt – bereit für Buchung
      </span>
    );
  }

  if (anfrage.status === "abgesagt") {
    const absagen = anfrage.antworten
      .filter((a) => a.antwort === "kann_nicht")
      .map((a) => a.mitglied.name);
    return (
      <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Absage {absagen.length > 0 ? `von ${absagen.join(", ")}` : ""}
      </span>
    );
  }

  const kannAnzahl = anfrage.antworten.filter((a) => a.antwort === "kann").length;
  return (
    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      {kannAnzahl}/{gesamtMitglieder} bestätigt
    </span>
  );
}
