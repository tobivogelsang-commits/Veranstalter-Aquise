// Fester Code für den Einwilligungs-Nachweis: Vor der Akquise-Mail wird
// telefonisch die Zusendung der Unterlagen vereinbart. Als eigener Typ statt
// Freitext, damit diese Einwilligung einheitlich, auffindbar und mit Zeitstempel
// dokumentiert ist (Nachweisbarkeit gegenüber UWG/DSGVO).
export const TELEFONAT_ZUSENDUNG = "telefonat_zusendung";

// Protokolltypen, bei denen der Freitext optional ist - der Typ selbst trägt
// die Aussage bereits. Bei allen anderen bleibt ein Text Pflicht.
export const TYPEN_OHNE_TEXTPFLICHT = new Set<string>([TELEFONAT_ZUSENDUNG]);

export const TYP_LABELS: Record<string, string> = {
  notiz: "Notiz",
  anruf: "Anrufversuch",
  telefonat_zusendung: "Telefonat – Zusendung vereinbart",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  kontakt: "Kontakt",
  email_gesendet: "E-Mail verschickt",
  email_beantwortet: "Auf E-Mail geantwortet",
};
