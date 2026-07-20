import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/authServer";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  // Bereits angemeldet? Dann direkt weiter, kein erneutes Login-Formular.
  const user = await getSessionUser();
  if (user) redirect("/");

  const { weiter } = await searchParams;
  const ziel = weiter && weiter.startsWith("/") && !weiter.startsWith("//") ? weiter : "/";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Anmelden</h1>
        <p className="mb-5 text-sm text-slate-500">
          Zugang zum Akquise-Tool. Die Team-App der Bands ist davon nicht betroffen.
        </p>
        <LoginForm weiter={ziel} />
      </div>
    </div>
  );
}
