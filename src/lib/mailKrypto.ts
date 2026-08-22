import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Verschlüsselung der Band-Mail-Passwörter in der Datenbank (AES-256-GCM).
// Der Schlüssel liegt bewusst NICHT in der DB, sondern als Umgebungsvariable
// (Vercel bzw. .env.local) - wer nur die Datenbank sieht, sieht damit nur
// Chiffrat. Hashen geht hier nicht: SMTP/IMAP brauchen das echte Passwort.
//
// Format: "enc1:<iv>:<auth-tag>:<chiffrat>" (jeweils base64). Werte OHNE
// dieses Präfix sind Klartext-Altbestand aus der Zeit vor der Umstellung -
// entschluesselePasswort reicht sie unverändert durch, beim nächsten
// Speichern werden sie verschlüsselt. Dadurch bricht nichts, egal in welcher
// Reihenfolge Code und Datenbestand umgestellt werden.

const PRAEFIX = "enc1:";

function holeSchluessel(): Buffer {
  const roh = process.env.MAIL_VERSCHLUESSELUNG_KEY;
  if (!roh) {
    throw new Error(
      "MAIL_VERSCHLUESSELUNG_KEY fehlt (32-Byte-Schlüssel, base64). Lokal in .env.local, auf Vercel als Environment Variable setzen."
    );
  }
  const schluessel = Buffer.from(roh, "base64");
  if (schluessel.length !== 32) {
    throw new Error(
      "MAIL_VERSCHLUESSELUNG_KEY muss 32 Byte base64-kodiert sein (erzeugen mit: openssl rand -base64 32)."
    );
  }
  return schluessel;
}

export function istVerschluesselt(wert: string): boolean {
  return wert.startsWith(PRAEFIX);
}

export function verschluesselePasswort(klartext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", holeSchluessel(), iv);
  const chiffrat = Buffer.concat([
    cipher.update(klartext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return (
    PRAEFIX +
    [iv, tag, chiffrat].map((teil) => teil.toString("base64")).join(":")
  );
}

export function entschluesselePasswort(wert: string): string {
  if (!istVerschluesselt(wert)) return wert; // Klartext-Altbestand
  const teile = wert.slice(PRAEFIX.length).split(":");
  if (teile.length !== 3) {
    throw new Error("Verschlüsseltes Passwort hat ein unbekanntes Format.");
  }
  const [iv, tag, chiffrat] = teile.map((teil) => Buffer.from(teil, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", holeSchluessel(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(chiffrat), decipher.final()]).toString(
    "utf8"
  );
}
