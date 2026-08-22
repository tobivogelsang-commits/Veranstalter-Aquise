"use client";

import { useActionState } from "react";
import {
  loeseEinladungEin,
  loesePasswortResetEin,
  type EinloesenState,
} from "@/lib/nutzerActions";

const feldKlasse =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function EinladungForm({
  token,
  zweck,
}: {
  token: string;
  zweck: "einladung" | "passwort_reset";
}) {
  const [state, action, pending] = useActionState<EinloesenState, FormData>(
    zweck === "einladung" ? loeseEinladungEin : loesePasswortResetEin,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      {zweck === "einladung" && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="benutzername"
            className="text-sm font-medium text-slate-700"
          >
            Benutzername
          </label>
          <input
            id="benutzername"
            name="benutzername"
            type="text"
            autoComplete="username"
            required
            minLength={2}
            maxLength={40}
            className={feldKlasse}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="passwort" className="text-sm font-medium text-slate-700">
          {zweck === "einladung" ? "Passwort" : "Neues Passwort"}
        </label>
        <input
          id="passwort"
          name="passwort"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={feldKlasse}
        />
        <p className="text-xs text-slate-400">Mindestens 8 Zeichen.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="wiederholung"
          className="text-sm font-medium text-slate-700"
        >
          Passwort wiederholen
        </label>
        <input
          id="wiederholung"
          name="wiederholung"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={feldKlasse}
        />
      </div>

      {state?.fehler && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.fehler}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending
          ? "Wird gespeichert…"
          : zweck === "einladung"
            ? "Zugang anlegen"
            : "Passwort setzen"}
      </button>
    </form>
  );
}
