import { NextResponse } from "next/server";
import { requireFreigabe } from "@/lib/authServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { berechneAngebotSummen } from "@/lib/angebotHelpers";
import { BELEG_KATEGORIE_LABELS } from "@/lib/belegKategorien";
import { ALLE_BANDS_PARAM } from "@/lib/constants";

// Jahres-Export fuer den Steuerberater: eine CSV mit allen Rechnungen und
// Belegen des gewaehlten Jahres (und optional der gewaehlten Band).
// Semikolon-getrennt und mit deutschem Dezimalkomma, damit Excel die Datei
// per Doppelklick korrekt oeffnet; BOM fuer die Umlaute.
export async function GET(request: Request) {
  await requireFreigabe("buchhaltung_ansehen");
  const url = new URL(request.url);
  const bandFilter = url.searchParams.get("band") ?? ALLE_BANDS_PARAM;
  const jahr = Number(url.searchParams.get("jahr")) || new Date().getFullYear();

  const [bands, rechnungen, belege] = await Promise.all([
    supabaseAdmin.from("bands").select("id, name"),
    supabaseAdmin.from("rechnungen").select("*").order("nummer"),
    supabaseAdmin.from("belege").select("*").order("datum"),
  ]);
  const bandName = (id: string) =>
    bands.data?.find((b) => b.id === id)?.name ?? "";
  const passt = (bandId: string, datum: string) =>
    (bandFilter === ALLE_BANDS_PARAM || bandId === bandFilter) &&
    new Date(datum).getFullYear() === jahr;

  const betrag = (wert: number) => wert.toFixed(2).replace(".", ",");
  const feld = (wert: string | null | undefined) =>
    `"${String(wert ?? "").replaceAll('"', '""')}"`;

  const zeilen: string[] = [];
  zeilen.push("Art;Band;Nummer/Kategorie;Datum;Leistungsdatum;Empfänger/Händler;Beschreibung;Status;Betrag EUR");

  for (const r of rechnungen.data ?? []) {
    if (!passt(r.band_id, r.datum)) continue;
    const summe = berechneAngebotSummen(r.positionen, r.ust_satz);
    zeilen.push(
      [
        "Rechnung",
        feld(bandName(r.band_id)),
        feld(r.nummer),
        r.datum,
        r.leistungsdatum ?? "",
        feld(r.empfaenger_name),
        feld(r.titel),
        r.status === "versendet" ? "offen" : r.status,
        betrag(summe.brutto),
      ].join(";")
    );
  }
  for (const b of belege.data ?? []) {
    if (!passt(b.band_id, b.datum)) continue;
    zeilen.push(
      [
        "Beleg",
        feld(bandName(b.band_id)),
        feld(BELEG_KATEGORIE_LABELS[b.kategorie]),
        b.datum,
        "",
        feld(b.haendler),
        feld(
          [b.beschreibung, b.mitglied_name ? `ausgelegt von ${b.mitglied_name}` : null]
            .filter(Boolean)
            .join(" - ")
        ),
        b.mitglied_name ? (b.erstattet_am ? "erstattet" : "Auslage offen") : "",
        `-${betrag(Number(b.betrag))}`,
      ].join(";")
    );
  }

  const inhalt = "﻿" + zeilen.join("\r\n");
  return new NextResponse(inhalt, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="buchhaltung-${jahr}.csv"`,
    },
  });
}
