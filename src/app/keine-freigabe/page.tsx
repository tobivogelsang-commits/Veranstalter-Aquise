import { redirect } from "next/navigation";
import { ersteErlaubteRoute, getFreigaben } from "@/lib/authServer";
import { signOut } from "@/lib/authActions";

export const dynamic = "force-dynamic";

// Landeseite für angemeldete Nutzer ohne jede Freigabe - z. B. direkt nach
// dem Einlösen einer Einladung, bevor der Admin Bereiche freigeschaltet hat.
export default async function KeineFreigabePage() {
  const freigaben = await getFreigaben();
  if (!freigaben) redirect("/login");

  // Sobald mindestens ein Bereich freigegeben ist, gehört der Nutzer nicht
  // mehr hierher.
  const ziel = ersteErlaubteRoute(freigaben);
  if (ziel !== "/keine-freigabe") redirect(ziel);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          Warte auf Freigabe
        </h1>
        <p className="mb-5 text-sm text-slate-500">
          Dein Zugang ist angelegt, aber es wurden noch keine Bereiche für dich
          freigeschaltet. Sobald der Admin dir Freigaben erteilt hat, geht es
          hier weiter.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );
}
