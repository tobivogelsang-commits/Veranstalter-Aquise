"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/venues/suche", label: "Suche" },
  { href: "/venues", label: "Veranstalter" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/kalender", label: "Kalender" },
  { href: "/emails", label: "E-Mails" },
  { href: "/setliste", label: "Setliste" },
  { href: "/einstellungen", label: "Einstellungen" },
];

export function Nav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Die Team-App (/team/...) ist bewusst von der Admin-Navigation getrennt -
  // Teilnehmer sollen keinen Zugriff/Sichtkontakt zu Veranstaltern, E-Mails,
  // Suche etc. bekommen, nur zur reduzierten Kalender-Ansicht dort. Die
  // Druckansicht (/druckansicht/...) ist bewusst komplett chromfrei, damit
  // beim Drucken/Als-PDF-Speichern keine Navigation mit aufs Papier kommt.
  if (pathname?.startsWith("/team") || pathname?.startsWith("/druckansicht")) {
    return null;
  }

  // Nur den Band-Filter über Navigationen hinweg mitnehmen, keine anderen
  // Query-Parameter (z. B. ?venue= für den E-Mail-Deep-Link von der
  // Veranstalter-Seite, der nur auf der Zielseite selbst Sinn ergibt).
  const band = searchParams.get("band");
  const query = band ? `band=${band}` : "";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <span className="text-lg font-semibold text-slate-900">
          Akquise-Tool
        </span>
        <nav className="flex gap-4">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={query ? `${link.href}?${query}` : link.href}
              className={clsx(
                "text-sm font-medium",
                pathname === link.href
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
