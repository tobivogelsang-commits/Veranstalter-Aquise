import { pruefeEinladung } from "@/lib/nutzerActions";
import { EinladungForm } from "./EinladungForm";

export const dynamic = "force-dynamic";

// Einlöseseite für Einmal-Links (Einladung bzw. Passwort-Reset). Öffentlich
// erreichbar - der Schutz ist das nicht erratbare Token im Pfad.
export default async function EinladungPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const status = await pruefeEinladung(token);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {!status.gueltig ? (
          <>
            <h1 className="mb-1 text-xl font-semibold text-slate-900">
              Link ungültig
            </h1>
            <p className="text-sm text-slate-500">
              Dieser Link ist abgelaufen, wurde schon benutzt oder existiert
              nicht. Bitte beim Admin einen neuen Link anfragen.
            </p>
          </>
        ) : status.zweck === "einladung" ? (
          <>
            <h1 className="mb-1 text-xl font-semibold text-slate-900">
              Zugang anlegen
            </h1>
            <p className="mb-5 text-sm text-slate-500">
              Willkommen! Leg deinen Benutzernamen und ein Passwort fest —
              damit meldest du dich künftig am Akquise-Tool an.
            </p>
            <EinladungForm token={token} zweck="einladung" />
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-semibold text-slate-900">
              Neues Passwort setzen
            </h1>
            <p className="mb-5 text-sm text-slate-500">
              Leg ein neues Passwort für deinen Zugang fest.
            </p>
            <EinladungForm token={token} zweck="passwort_reset" />
          </>
        )}
      </div>
    </div>
  );
}
