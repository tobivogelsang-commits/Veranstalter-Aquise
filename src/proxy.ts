import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Öffentliche Pfade ohne Login: die Team-App der Bandmitglieder und die
// Login-Seite selbst. Die öffentlichen API-Routen (/api/team-*, /api/kalender)
// sowie statische Dateien sind bereits über den matcher unten ausgenommen.
const OEFFENTLICHE_PREFIXE = ["/login", "/team"];

function istOeffentlich(pathname: string): boolean {
  return OEFFENTLICHE_PREFIXE.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validiert das JWT gegen Supabase Auth (nicht nur das Cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !istOeffentlich(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("weiter", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Läuft auf allen Seiten-Routen, aber NICHT auf API-Routen (die öffentlichen
  // /api/team-*- und /api/kalender-Endpunkte sowie statische Assets - alles mit
  // Dateiendung, z. B. team-sw.js, Icons - bleiben ungeschützt erreichbar).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
