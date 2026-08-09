import type { AngebotPosition } from "@/lib/database.types";

// Summen eines Angebots. Bei ust_satz = 0 (Kleinunternehmer nach § 19 UStG)
// ist die Summe zugleich der Endbetrag, es wird keine Steuer ausgewiesen.
export function berechneAngebotSummen(positionen: AngebotPosition[], ustSatz: number) {
  const netto = positionen.reduce((summe, p) => summe + (Number(p.betrag) || 0), 0);
  const steuer = ustSatz > 0 ? (netto * ustSatz) / 100 : 0;
  return { netto, steuer, brutto: netto + steuer };
}

export function formatEuro(betrag: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(betrag);
}

// "2026-08-09" -> "09.08.2026" (Postgres-Datum ohne UTC-Umweg formatieren).
export function formatDatumLang(datum: string | null): string {
  if (!datum) return "";
  return datum.split("-").reverse().join(".");
}
