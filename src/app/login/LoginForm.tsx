"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/lib/authActions";

export function LoginForm({ weiter }: { weiter: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    signIn,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="weiter" value={weiter} />

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
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
        {pending ? "Anmeldung läuft…" : "Anmelden"}
      </button>
    </form>
  );
}
