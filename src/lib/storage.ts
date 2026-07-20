import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Zwei Buckets mit bewusst unterschiedlicher Sichtbarkeit:
//
// - ANHANG_BUCKET (privat): Mail-Anhänge und hinterlegte Dokumente (Rider,
//   Verträge, Angebote). Diese Dateien sollen NICHT frei im Netz liegen. Sie
//   werden beim Versand serverseitig in die Mail kopiert; in der App entstehen
//   nur kurzlebige signierte Download-Links.
// - BILD_BUCKET (öffentlich): Bilder, die im Mailtext als <img src> eingebettet
//   werden. Die müssen dauerhaft öffentlich erreichbar sein, weil das
//   Mailprogramm des Empfängers sie noch Wochen später nachlädt - eine
//   signierte URL wäre längst abgelaufen. Hier gehören deshalb nur Inhalte
//   hinein, die ohnehin an Veranstalter rausgehen (Logos, Pressefotos).
export const ANHANG_BUCKET = "email-anhaenge";
export const BILD_BUCKET = "mail-bilder";

const GUELTIG_SEKUNDEN = 60 * 60;

// Baut aus einem Dateinamen einen sicheren Storage-Pfad unterhalb der Band.
export function anhangPfad(bandId: string, dateiname: string, unterordner?: string): string {
  const sicherName = dateiname.replace(/[^a-zA-Z0-9._-]/g, "_");
  const teile = [bandId, unterordner, `${Date.now()}-${sicherName}`].filter(Boolean);
  return teile.join("/");
}

// Kurzlebiger Download-Link für die Anzeige in der App.
export async function signierteAnhangUrl(pfad: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(ANHANG_BUCKET)
    .createSignedUrl(pfad, GUELTIG_SEKUNDEN);
  if (error || !data) return null;
  return data.signedUrl;
}

// Sammel-Variante: ein Request statt einer pro Anhang.
export async function signierteAnhangUrls(
  pfade: string[]
): Promise<Record<string, string>> {
  const eindeutig = Array.from(new Set(pfade.filter(Boolean)));
  if (eindeutig.length === 0) return {};

  const { data, error } = await supabaseAdmin.storage
    .from(ANHANG_BUCKET)
    .createSignedUrls(eindeutig, GUELTIG_SEKUNDEN);
  if (error || !data) return {};

  const zuordnung: Record<string, string> = {};
  for (const eintrag of data) {
    if (eintrag.path && eintrag.signedUrl) {
      zuordnung[eintrag.path] = eintrag.signedUrl;
    }
  }
  return zuordnung;
}

// Für den Mailversand: Datei serverseitig holen und direkt anhängen, statt
// nodemailer eine URL abrufen zu lassen (die bei einem privaten Bucket ohne
// Signatur gar nicht mehr funktionieren würde).
export async function ladeAnhangBuffer(pfad: string): Promise<Buffer | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(ANHANG_BUCKET)
    .download(pfad);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
