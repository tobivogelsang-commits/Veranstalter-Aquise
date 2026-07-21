import clsx from "clsx";
import type { TeilnahmeStand } from "@/lib/types";

// Zeigt "X/Y dabei" plus die Namen der Zu-/Absagen und der noch Offenen.
// `aufDunkel` für Flächen mit dunklem Foto-Hintergrund (immersives Dashboard),
// sonst neutrale Farben mit dark:-Varianten.
export function TerminTeilnahmeUebersicht({
  stand,
  aufDunkel = false,
}: {
  stand: TeilnahmeStand;
  aufDunkel?: boolean;
}) {
  if (stand.gesamt === 0) return null;

  const gedaempft = aufDunkel ? "text-slate-300" : "text-slate-500 dark:text-slate-400";
  const betont = aufDunkel ? "text-white" : "text-slate-700 dark:text-slate-200";

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <p className={clsx("font-medium", betont)}>
        {stand.dabei.length}/{stand.gesamt} dabei
      </p>
      {stand.dabei.length > 0 && (
        <p className={gedaempft}>
          <span className="font-medium text-green-500">Dabei:</span> {stand.dabei.join(", ")}
        </p>
      )}
      {stand.abgesagt.length > 0 && (
        <p className={gedaempft}>
          <span className="font-medium text-red-500">Abgesagt:</span> {stand.abgesagt.join(", ")}
        </p>
      )}
      {stand.offen.length > 0 && (
        <p className={gedaempft}>
          <span className="font-medium">Offen:</span> {stand.offen.join(", ")}
        </p>
      )}
    </div>
  );
}
