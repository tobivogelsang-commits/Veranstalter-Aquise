# Projekt-Gehirn

Dauerhaftes, versioniertes Überblicks-Dokument für die App (Veranstalter-Akquise
+ Team-App der beiden Coverbands **90er Coverband** und **Backseat Alley**).

**Warum diese Datei?** Chats haben ein begrenztes Kontextfenster und Claudes
Memory liegt nur lokal. Dieses Dokument liegt **im Git-Repo** — es ist damit
dauerhaft, auf GitHub gesichert, rechner-unabhängig und für jede künftige
Sitzung (und jeden Menschen) lesbar. Es ist die „Landkarte"; Details stehen in
`README.md`, im Code und in der Git-Historie.

> Pflege: Wenn ein Feature fertig ist oder eine wichtige Entscheidung fällt,
> hier **eine Zeile** ergänzen. Kurz halten — dies ist ein Index, kein Roman.

Letzte Aktualisierung: 2026-08-22

---

## Was die App ist

Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres). Zwei
getrennte Oberflächen:

- **Desktop / Akquise-Tool** — hinter Login (Supabase Auth, nur Inhaber):
  Veranstalter-Datenbank, Status-Pipeline (Kanban), E-Mail (SMTP/IMAP),
  Kalender, Angebote, Merch, Setlisten, Produktion.
- **Team-App** (`/team/<band-id>`) — für Bandmitglieder. Konto nur über
  Einmal-Einladungslink vom Admin, Anmeldung mit Name + Passwort. Reduziert:
  Dashboard, Kalender, Setliste, Songtexte, Merch, Produktion — kein Zugriff
  auf Akquise/E-Mail/Pipeline.

Setup, Env-Variablen und Datenmodell: siehe `README.md`.

---

## Funktionen (Stand 2026-08-22, alles LIVE)

- **Akquise:** Veranstalter-DB, Suche (SerpApi/Google Maps/Events), Kanban-
  Pipeline `neu → … → gebucht`, Follow-ups, Dashboard.
- **E-Mail pro Band:** Senden (SMTP) + Empfangen (IMAP), Zuordnung zu
  Veranstaltern, Vorlagen, Dokument-Anhänge.
- **Kalender:** Monats-/Jahresansicht, `.ics`-Abo pro Band, externer
  Proberaum-Belegungskalender (nur Anzeige, nicht im Abo).
- **Eigene Termine** (Probe/Konzertmöglichkeit/Event): Wiederholung, Uhrzeit,
  anlegen/bearbeiten/löschen am Desktop **und** in der Team-App; Zu-/Absage
  pro Vorkommen; „X/Y dabei"-Übersicht; Push bei neuem Termin.
- **Gebuchter Auftritt:** Zeiten (Treffen/​Soundcheck/​Einlass/​Beginn),
  mehrere Ansprechpartner, Setliste mit berechneten Set-Zeiten + Auftritts-
  ende, Adresse mit Navi-Links — Desktop + Team-App (GigInfoModal).
- **Setlisten:** Song-Katalog, Drag&Drop, Pausen, Druckansicht
  (`/druckansicht/<id>`, öffentlich).
- **Songtexte:** Bühnenansicht, mitlaufender Text (Wake Lock), eigenes Timing
  einlernbar. Quelle: lrclib.net.
- **Merch-Lager:** Bestand, Nachbestellung, Vorlagen, Inventur (Desktop +
  Team-App-Tab).
- **Angebote:** Editor, PDF, Mail-Versand, Pipeline-Status, Textbausteine.
- **Produktion:** eigener Tab/Bereich.
- **Team-App:** Push (Web-Push/VAPID), Dunkelmodus, Home-Screen-Icon,
  Urlaube/Abwesenheiten, Mitgliederverwaltung, Passwort-Anmeldung.
- **Nutzer & Freigaben (Desktop):** Admin lädt per Einmal-Link ein (7 Tage,
  gehasht in DB), Nutzer legt Benutzername + Passwort an, Login per
  Benutzername ODER E-Mail; Freigabe-Matrix pro Nutzer/Bereich in den
  Einstellungen; Passwort-Reset per Einmal-Link (24 h); Nutzer löschen.

---

## Wichtige Entscheidungen (das „Warum")

- **Zwei Zugangsmodelle:** Desktop hinter Supabase-Auth-Login mit Freigaben;
  Team-App mit eigenen Konten (`band_mitglieder`, scrypt-Passwort), Konto nur
  per Einmal-Link (Migration 0044, `?einladung=<token>` auf `/team/<band>`).
  Team-taugliche Server-Aktionen laufen bewusst **ohne** Desktop-Login —
  abgesichert über die Mitglieds-UUID + Band-Zugehörigkeit.
- **RLS-Lockdown (Migration 0016):** anon/authenticated haben KEINEN direkten
  Tabellenzugriff mehr; alle Reads/Writes laufen serverseitig über den
  `service_role`-Client. In `queries.ts` ist `supabase` bewusst ein Alias auf
  `supabaseAdmin`.
- **Wiederkehrende Termine** werden NICHT als Zeilen gespeichert, sondern zur
  Anzeige im sichtbaren Zeitraum berechnet; Zu-/Absagen hängen am
  Vorkommen-Datum.
- **Protokoll bleibt lokal:** Migrationen werden **manuell** im Supabase-SQL-
  Editor ausgeführt (ein gemeinsames Projekt für lokal + Vercel).
- **Grundsatz UI:** keine Zahlen/Platzhalter anzeigen, wo nichts eingetragen ist.
- **Freigaben-System (Migration 0043, 2026-08-22):** Desktop-Nutzer haben
  einzelne Freigaben pro Bereich (`nutzer_freigaben`, fail closed); Admin =
  `app_metadata.rolle = "admin"` (nur via Dashboard/service_role setzbar).
  `requireOwner()` ersetzt durch `requireAnmeldung/requireAdmin/requireFreigabe`
  in Actions + `require*Seite()` in allen geschützten Seiten. Einladungs-/
  Reset-Links: Tabelle `einladungen` (Einmal-Token, gehasht).

---

## Betrieb / Deploy

- **Vercel** (Frontend/API) + **Supabase** (DB, ein Projekt für alle Umgebungen).
- **Node 22.x** nötig.
- **Migrationen manuell** in Supabase ausführen, bevor abhängiger Code live geht
  (`supabase/migrations/`, aktuell bis 0044).
- **Mail-Passwörter verschlüsselt** (AES-256-GCM, `mailKrypto.ts`); Schlüssel
  `MAIL_VERSCHLUESSELUNG_KEY` in .env.local + Vercel-Env (identisch!). Bei
  Schlüsselverlust: neu erzeugen, Mail-Passwörter in den Einstellungen neu
  eintragen.
- Team-App-Link: `https://veranstalter-aquise.vercel.app/team/<band-id>`.

---

## Offene Punkte / Ideen

- Team-App-Home-Screen-Icon auch für die **zweite Band** (bisher nur Trash Back).
- **Sicherheit/DSGVO-Reste:** Sperrliste, DSGVO-Papierkram (Mail-Passwörter
  sind seit 2026-08-22 verschlüsselt).
- **Suchtool** soll zusätzlich Plattenfirmen abdecken (noch nicht gescoped).
- **Team-App nach 0044:** 7 Bestandsmitglieder ohne Passwort brauchen je
  einen Zugangslink (Einstellungen → Band → Team-App → "Zugangslink").
- `bands.registrierung_offen` ist obsolet (kein Code liest sie) — bei
  Gelegenheit per Migration entfernen.

---

## Wie das Gedächtnis organisiert ist (2 Ebenen)

1. **Dieses Dokument (`docs/projekt-gehirn.md`)** — dauerhaft in Git, die
   Landkarte. Pro fertigem Feature / wichtiger Entscheidung eine Zeile ergänzen.
2. **Claudes Memory** (lokal, `~/.claude/.../memory/`) — Arbeitsnotizen +
   Index (`MEMORY.md`), pro Thema eine Datei; wird in jeder Sitzung geladen.
   Kann bei Rechnerwechsel verloren gehen → Wichtiges gehört auch hierher.

Detail-Historie: `git log`. Aufbau/Setup: `README.md`.
