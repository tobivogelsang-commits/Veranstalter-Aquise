import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { berechneAngebotSummen, formatDatumLang, formatEuro } from "@/lib/angebotHelpers";
import type { Angebot, Band } from "@/lib/types";

// Angebots-PDF: Briefkopf mit Absender und Logo rechts, Empfängeranschrift,
// Einleitung, Positionen mit Summen, Bedingungen und ein Fuß mit Band- und
// Bankdaten. Bewusst nüchtern gehalten (Geschäftsbrief), damit es auch bei
// langen Texten sauber umbricht.

const FARBE_TEXT = "#0f172a";
const FARBE_GRAU = "#64748b";
const FARBE_LINIE = "#cbd5e1";

const stil = StyleSheet.create({
  seite: {
    paddingTop: 40,
    paddingBottom: 90, // Platz für den fest positionierten Fuß
    paddingHorizontal: 45,
    fontSize: 10,
    color: FARBE_TEXT,
    lineHeight: 1.5,
    fontFamily: "Helvetica",
  },
  kopf: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
  },
  absenderBlock: { flexDirection: "column", maxWidth: 300 },
  absenderName: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  logo: { width: 90, height: 90, objectFit: "contain" },
  empfaengerZeile: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 26,
  },
  empfaenger: { flexDirection: "column", maxWidth: 280 },
  metaBlock: { flexDirection: "column", alignItems: "flex-end" },
  metaZeile: { flexDirection: "row", gap: 8 },
  metaLabel: { color: FARBE_GRAU },
  titel: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  absatz: { marginBottom: 14 },
  tabellenKopf: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: FARBE_TEXT,
    paddingBottom: 4,
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
  },
  zeile: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: FARBE_LINIE,
    paddingVertical: 6,
  },
  spalteText: { flex: 1, paddingRight: 12 },
  spalteBetrag: { width: 90, textAlign: "right" },
  summenBlock: { marginTop: 12, alignItems: "flex-end" },
  summenZeile: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  summenLabel: { width: 130, textAlign: "right", paddingRight: 12, color: FARBE_GRAU },
  summenWert: { width: 90, textAlign: "right" },
  gesamtZeile: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: FARBE_TEXT,
    fontFamily: "Helvetica-Bold",
  },
  hinweis: { marginTop: 12, color: FARBE_GRAU },
  bedingungenTitel: { fontFamily: "Helvetica-Bold", marginBottom: 2, marginTop: 16 },
  fuss: {
    position: "absolute",
    bottom: 30,
    left: 45,
    right: 45,
    borderTopWidth: 0.5,
    borderTopColor: FARBE_LINIE,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: FARBE_GRAU,
  },
  fussSpalte: { flexDirection: "column", maxWidth: 165 },
});

function Zeilen({ text }: { text: string }) {
  // Absätze aus Freitext erhalten - react-pdf bricht \n nicht automatisch um.
  return (
    <>
      {text.split("\n").map((zeile, i) => (
        <Text key={i}>{zeile || " "}</Text>
      ))}
    </>
  );
}

// Das Logo kommt entweder als öffentliche URL (hochgeladenes Band-Logo) oder
// als App-interner Pfad wie "/team-icons/…" (die alte statische Zuordnung).
// react-pdf kann Letzteren NICHT auflösen - es sucht dann im Dateisystem und
// lässt das Bild kommentarlos weg. Deshalb wird eine solche Datei hier vorab
// aus dem public-Ordner gelesen und als Rohdaten übergeben.
type LogoQuelle = string | { data: Buffer; format: "png" | "jpg" };

async function ladeLogo(logoUrl: string | null): Promise<LogoQuelle | null> {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (!logoUrl.startsWith("/")) return null;

  try {
    const datei = path.join(process.cwd(), "public", logoUrl);
    const data = await readFile(datei);
    const format = /\.png$/i.test(logoUrl) ? "png" : "jpg";
    return { data, format };
  } catch (err) {
    console.error("Logo für das Angebots-PDF nicht ladbar", err);
    return null;
  }
}

export function AngebotDokument({
  angebot,
  band,
  logo,
}: {
  angebot: Angebot;
  band: Band;
  logo: LogoQuelle | null;
}) {
  const summen = berechneAngebotSummen(angebot.positionen, angebot.ust_satz);
  const absenderName = band.absender_name?.trim() || band.name;
  const absenderZeile = [
    absenderName,
    band.absender_strasse,
    [band.absender_plz, band.absender_ort].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Document title={`${angebot.titel} ${angebot.nummer}`} author={absenderName}>
      <Page size="A4" style={stil.seite}>
        <View style={stil.kopf}>
          <View style={stil.absenderBlock}>
            <Text style={stil.absenderName}>{absenderName}</Text>
            {band.absender_strasse && <Text>{band.absender_strasse}</Text>}
            {(band.absender_plz || band.absender_ort) && (
              <Text>
                {[band.absender_plz, band.absender_ort].filter(Boolean).join(" ")}
              </Text>
            )}
            {band.absender_telefon && <Text>Tel. {band.absender_telefon}</Text>}
            {band.kontakt_email && <Text>{band.kontakt_email}</Text>}
          </View>
          {/* Kein HTML-<img>, sondern das Image-Element von react-pdf - dort
              gibt es kein alt-Attribut, die a11y-Regel greift hier nicht. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logo && <Image src={logo} style={stil.logo} />}
        </View>

        <View style={stil.empfaengerZeile}>
          <View style={stil.empfaenger}>
            {absenderZeile && (
              <Text style={{ fontSize: 7, color: FARBE_GRAU, marginBottom: 8 }}>
                {absenderZeile}
              </Text>
            )}
            <Text>{angebot.empfaenger_name}</Text>
            {angebot.empfaenger_ansprechpartner && (
              <Text>{angebot.empfaenger_ansprechpartner}</Text>
            )}
            {angebot.empfaenger_strasse && <Text>{angebot.empfaenger_strasse}</Text>}
            {(angebot.empfaenger_plz || angebot.empfaenger_ort) && (
              <Text>
                {[angebot.empfaenger_plz, angebot.empfaenger_ort]
                  .filter(Boolean)
                  .join(" ")}
              </Text>
            )}
          </View>

          <View style={stil.metaBlock}>
            <View style={stil.metaZeile}>
              <Text style={stil.metaLabel}>Angebotsnummer</Text>
              <Text>{angebot.nummer}</Text>
            </View>
            <View style={stil.metaZeile}>
              <Text style={stil.metaLabel}>Datum</Text>
              <Text>{formatDatumLang(angebot.datum)}</Text>
            </View>
            {angebot.gueltig_bis && (
              <View style={stil.metaZeile}>
                <Text style={stil.metaLabel}>Gültig bis</Text>
                <Text>{formatDatumLang(angebot.gueltig_bis)}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={stil.titel}>{angebot.titel}</Text>

        {angebot.einleitung && (
          <View style={stil.absatz}>
            <Zeilen text={angebot.einleitung} />
          </View>
        )}

        <View style={stil.tabellenKopf}>
          <Text style={stil.spalteText}>Leistung</Text>
          <Text style={stil.spalteBetrag}>Betrag</Text>
        </View>
        {angebot.positionen.map((position, i) => (
          <View key={i} style={stil.zeile} wrap={false}>
            <View style={stil.spalteText}>
              <Zeilen text={position.beschreibung} />
            </View>
            <Text style={stil.spalteBetrag}>{formatEuro(Number(position.betrag) || 0)}</Text>
          </View>
        ))}

        <View style={stil.summenBlock}>
          {angebot.ust_satz > 0 ? (
            <>
              <View style={stil.summenZeile}>
                <Text style={stil.summenLabel}>Summe (netto)</Text>
                <Text style={stil.summenWert}>{formatEuro(summen.netto)}</Text>
              </View>
              <View style={stil.summenZeile}>
                <Text style={stil.summenLabel}>
                  zzgl. {angebot.ust_satz} % USt
                </Text>
                <Text style={stil.summenWert}>{formatEuro(summen.steuer)}</Text>
              </View>
              <View style={stil.gesamtZeile}>
                <Text style={stil.summenLabel}>Gesamtbetrag</Text>
                <Text style={stil.summenWert}>{formatEuro(summen.brutto)}</Text>
              </View>
            </>
          ) : (
            <View style={stil.gesamtZeile}>
              <Text style={stil.summenLabel}>Gesamtbetrag</Text>
              <Text style={stil.summenWert}>{formatEuro(summen.netto)}</Text>
            </View>
          )}
        </View>

        {angebot.ust_satz === 0 && (
          <Text style={stil.hinweis}>
            Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
          </Text>
        )}

        {angebot.zahlungsbedingungen && (
          <>
            <Text style={stil.bedingungenTitel}>Zahlungsbedingungen</Text>
            <Zeilen text={angebot.zahlungsbedingungen} />
          </>
        )}

        {angebot.nachbemerkung && (
          <View style={{ marginTop: 14 }}>
            <Zeilen text={angebot.nachbemerkung} />
          </View>
        )}

        <View style={stil.fuss} fixed>
          <View style={stil.fussSpalte}>
            <Text>{absenderName}</Text>
            {band.absender_strasse && <Text>{band.absender_strasse}</Text>}
            {(band.absender_plz || band.absender_ort) && (
              <Text>
                {[band.absender_plz, band.absender_ort].filter(Boolean).join(" ")}
              </Text>
            )}
          </View>
          <View style={stil.fussSpalte}>
            {band.absender_telefon && <Text>Tel. {band.absender_telefon}</Text>}
            {band.kontakt_email && <Text>{band.kontakt_email}</Text>}
            {band.steuernummer && <Text>St.-Nr. {band.steuernummer}</Text>}
            {band.ust_id && <Text>USt-IdNr. {band.ust_id}</Text>}
          </View>
          <View style={stil.fussSpalte}>
            {band.bank_name && <Text>{band.bank_name}</Text>}
            {band.bank_inhaber && <Text>{band.bank_inhaber}</Text>}
            {band.iban && <Text>IBAN {band.iban}</Text>}
            {band.bic && <Text>BIC {band.bic}</Text>}
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function erzeugeAngebotPdf(
  angebot: Angebot,
  band: Band,
  logoUrl: string | null
): Promise<Buffer> {
  const logo = await ladeLogo(logoUrl);
  return renderToBuffer(
    <AngebotDokument angebot={angebot} band={band} logo={logo} />
  );
}
