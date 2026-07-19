export function formatDauer(sekunden: number | null): string {
  if (sekunden === null || Number.isNaN(sekunden)) return "–";
  const minuten = Math.floor(sekunden / 60);
  const rest = sekunden % 60;
  return `${minuten}:${String(rest).padStart(2, "0")}`;
}

// Parst sowohl "3:42" als auch reine Sekundenangaben ("222").
export function parseDauerEingabe(text: string): number | null {
  const bereinigt = text.trim();
  if (!bereinigt) return null;

  if (bereinigt.includes(":")) {
    const [minutenText, sekundenText] = bereinigt.split(":");
    const minuten = Number(minutenText);
    const sekunden = Number(sekundenText);
    if (Number.isNaN(minuten) || Number.isNaN(sekunden)) return null;
    return minuten * 60 + sekunden;
  }

  const sekunden = Number(bereinigt);
  return Number.isNaN(sekunden) ? null : sekunden;
}

export function summeDauer(sekundenListe: (number | null)[]): number {
  return sekundenListe.reduce<number>((summe, s) => summe + (s ?? 0), 0);
}
