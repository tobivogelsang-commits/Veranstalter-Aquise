import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">
        Seite nicht gefunden
      </h1>
      <p className="text-sm text-slate-500">
        Die angeforderte Seite existiert nicht.
      </p>
      <Link href="/" className="text-sm font-medium text-slate-900 underline">
        Zurück zum Dashboard
      </Link>
    </div>
  );
}
