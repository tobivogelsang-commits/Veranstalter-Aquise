import { getFreigaben } from "@/lib/authServer";
import type { FreigabeBereich } from "@/lib/freigabenBereiche";
import { Nav } from "@/components/Nav";

// Welcher Navigations-Link welche Freigabe braucht. "/einstellungen" fehlt
// bewusst - der Link ist fest dem Admin vorbehalten.
const LINK_BEREICHE: Record<string, FreigabeBereich> = {
  "/": "akquise",
  "/venues/suche": "akquise",
  "/venues": "akquise",
  "/pipeline": "akquise",
  "/kalender": "kalender",
  "/emails": "emails_lesen",
  "/angebote": "angebote_ansehen",
  "/setliste": "setlisten",
  "/produktion": "produktion",
  "/merch": "merch",
};

// Ermittelt serverseitig, welche Links der angemeldete Nutzer sehen darf.
// Nur Anzeige-Komfort - die Durchsetzung sitzt in den Seiten und Actions.
// getFreigaben ist pro Request memoisiert, die Seite selbst fragt also nicht
// doppelt ab.
export async function NavServer() {
  const freigaben = await getFreigaben();

  const erlaubteHrefs = freigaben
    ? Object.entries(LINK_BEREICHE)
        .filter(([, bereich]) => freigaben.bereiche[bereich])
        .map(([href]) => href)
    : [];
  if (freigaben?.istAdmin) erlaubteHrefs.push("/einstellungen");

  return <Nav erlaubteHrefs={erlaubteHrefs} />;
}
