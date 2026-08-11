// Passwoerter der Team-Mitglieder. Internes Server-Modul, kein Aktions-Endpunkt
// ("server-only" laesst den Build scheitern, falls es je in eine
// Client-Komponente importiert wird - Hashing gehoert nicht in den Browser).
import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  passwort: string,
  salz: Buffer,
  laenge: number
) => Promise<Buffer>;

const SALZ_BYTES = 16;
const HASH_BYTES = 64;

// scrypt aus der Node-Standardbibliothek statt bcrypt/argon2: kein zusaetzliches
// Paket noetig, und es ist bewusst rechenaufwendig, also nicht in Sekunden
// durchprobierbar. Format: scrypt$<salz-hex>$<hash-hex> - das Salz steht mit im
// Feld, damit jede Zeile fuer sich pruefbar ist.
export async function hashePasswort(passwort: string): Promise<string> {
  const salz = randomBytes(SALZ_BYTES);
  const hash = await scryptAsync(passwort, salz, HASH_BYTES);
  return `scrypt$${salz.toString("hex")}$${hash.toString("hex")}`;
}

// Vergleich in konstanter Zeit (timingSafeEqual): Ein zeichenweiser Vergleich
// wuerde ueber die Antwortzeit verraten, wie viele Zeichen stimmen.
export async function passwortStimmt(
  passwort: string,
  gespeichert: string | null
): Promise<boolean> {
  if (!gespeichert) return false;
  const [verfahren, salzHex, hashHex] = gespeichert.split("$");
  if (verfahren !== "scrypt" || !salzHex || !hashHex) return false;

  const erwartet = Buffer.from(hashHex, "hex");
  const berechnet = await scryptAsync(passwort, Buffer.from(salzHex, "hex"), erwartet.length);
  return berechnet.length === erwartet.length && timingSafeEqual(berechnet, erwartet);
}
