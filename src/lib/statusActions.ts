// BEWUSST KEIN "use server": Diese Datei ist ein internes Server-Modul, kein
// Aktions-Endpunkt. Als Server Action wäre setzeStatusVorwaerts über seine
// Kennung von jeder Adresse aus aufrufbar (auch von der öffentlichen
// Team-Seite) und könnte den Pipeline-Status fremder Kontakte verschieben.
// "server-only" lässt den Build scheitern, falls jemand die Datei versehentlich
// in eine Client-Komponente importiert.
import "server-only";

// service_role-Client (umgeht RLS). setzeStatusVorwaerts wird sowohl aus
// Inhaber-Aktionen als auch aus dem öffentlichen Team-Flow (beantworteAnfrage)
// heraus genutzt - der Schutz sitzt an den jeweiligen Einstiegspunkten.
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { STATUS_ORDER } from "@/lib/constants";
import type { Status } from "@/lib/database.types";

// Reine, guarded Status-Änderung ohne Wissen über Gig-Anfragen o. Ä. - rückt
// nur vor (nie zurück), damit ein bereits weiter fortgeschrittener Kontakt
// nicht versehentlich zurückgesetzt wird. Absichtlich in einer eigenen Datei
// ohne Abhängigkeit zu actions.ts/teamActions.ts, damit beide diese Funktion
// nutzen können, ohne einen Zirkelimport zu erzeugen. Gibt zurück, ob die
// Änderung tatsächlich stattgefunden hat.
export async function setzeStatusVorwaerts(
  venueId: string,
  bandId: string,
  zielStatus: Status,
  naechsterFollowUpAm?: string | null
): Promise<boolean> {
  const { data: bestehende } = await supabase
    .from("venue_band_status")
    .select("status")
    .eq("venue_id", venueId)
    .eq("band_id", bandId)
    .maybeSingle();

  if (!bestehende) return false;
  if (STATUS_ORDER.indexOf(zielStatus) <= STATUS_ORDER.indexOf(bestehende.status)) {
    return false;
  }

  const { error } = await supabase
    .from("venue_band_status")
    .update({
      status: zielStatus,
      letzter_kontakt_am: new Date().toISOString(),
      ...(naechsterFollowUpAm !== undefined
        ? { naechster_follow_up_am: naechsterFollowUpAm }
        : {}),
    })
    .eq("venue_id", venueId)
    .eq("band_id", bandId);
  if (error) throw new Error(error.message);

  return true;
}
