import "server-only";
import { createHash, randomBytes } from "crypto";

// Gemeinsame Bausteine fuer Einmal-Links (Desktop-Einladungen, Passwort-
// Resets, Team-App-Einladungen). In der DB liegt nur der SHA-256-Hash des
// Tokens; der Klartext steht ausschliesslich im verschickten Link.

export function erzeugeToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function ablaufIn(stunden: number): string {
  return new Date(Date.now() + stunden * 60 * 60 * 1000).toISOString();
}
