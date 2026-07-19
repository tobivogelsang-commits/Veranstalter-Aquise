# Veranstalter-Akquise

Web-App zur Verwaltung der Veranstalter-Akquise für **90er Coverband** und
**Backseat Alley**: Veranstalter-Datenbank, Status-Pipeline (Kanban) und
Follow-up-Übersicht.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres) · dnd-kit

## 1. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) einloggen bzw. Account anlegen (kostenlose Stufe reicht).
2. **New Project** → Namen vergeben (z. B. `veranstalter-akquise`), Datenbank-Passwort setzen, Region wählen → erstellen.
3. Im Projekt-Dashboard unter **Project Settings → API**:
   - **Project URL** kopieren
   - **anon public** Key kopieren

## 2. Datenbank-Schema anlegen

Im Supabase-Dashboard unter **SQL Editor**:

1. Inhalt von [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) einfügen und ausführen.
2. Inhalt von [`supabase/migrations/0002_open_policies.sql`](supabase/migrations/0002_open_policies.sql) einfügen und ausführen. Neue Supabase-Projekte aktivieren RLS automatisch auf allen Tabellen – ohne diese (bewusst offenen) Policies blockiert das jeden Zugriff über den anon-Key, auch lesend.
3. Inhalt von [`supabase/migrations/0003_band_materialien.sql`](supabase/migrations/0003_band_materialien.sql) einfügen und ausführen. Legt die Tabelle für die Band-Materialliste (Stage Rider, EPK, YouTube, ...) an.
4. Inhalt von [`supabase/migrations/0004_band_email.sql`](supabase/migrations/0004_band_email.sql) einfügen und ausführen. Legt die Tabellen für E-Mail-Zugangsdaten und -Verlauf pro Band an.
5. Inhalt von [`supabase/migrations/0005_band_emails_venue.sql`](supabase/migrations/0005_band_emails_venue.sql) einfügen und ausführen. Verknüpft E-Mails mit dem passenden Veranstalter.
6. Inhalt von [`supabase/migrations/0006_venue_termin.sql`](supabase/migrations/0006_venue_termin.sql) einfügen und ausführen. Ergänzt das Veranstaltungsdatum am Veranstalter.
7. Inhalt von [`supabase/migrations/0007_venue_strasse.sql`](supabase/migrations/0007_venue_strasse.sql) einfügen und ausführen. Ergänzt Straße/Hausnummer am Veranstalter.
8. Inhalt von [`supabase/migrations/0008_team_app.sql`](supabase/migrations/0008_team_app.sql) einfügen und ausführen. Legt die Tabellen für die Team-App an (Mitglieder, Verfügbarkeitsanfragen, Antworten).
9. (Optional, für Beispieldaten) Inhalt von [`supabase/seed.sql`](supabase/seed.sql) einfügen und ausführen. Legt beide Bands sowie je einen Beispiel-Veranstalter pro Band an.

Alternativ mit der [Supabase CLI](https://supabase.com/docs/guides/cli) lokal:

```bash
npx supabase login
npx supabase link --project-ref <dein-projekt-ref>
npx supabase db push
```

## 3. Umgebungsvariablen setzen

`.env.local` im Projektroot mit den Werten aus Schritt 1 befüllen (Datei existiert bereits als Platzhalter):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://dein-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key
SERPAPI_KEY=dein-serpapi-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=dein-vapid-public-key
VAPID_PRIVATE_KEY=dein-vapid-private-key
PROBERAUM_ICAL_URL=dein-proberaum-ical-export-link
```

`.env.local` ist in `.gitignore` und wird nicht committet. `.env.local.example` dient als Vorlage.

### Supabase Service Role Key (für Band-E-Mail-Zugangsdaten)

1. Im Supabase-Dashboard unter **Project Settings → API Keys** den Key im Feld
   **"secret"** (neues Namensschema; entspricht dem alten "service_role") kopieren.
2. Als `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` eintragen.

**Wichtig:** Dieser Key umgeht RLS komplett (voller Admin-Zugriff auf die Datenbank).
Er wird ausschließlich in `src/lib/supabaseAdmin.ts` verwendet (`server-only`-Guard
sorgt dafür, dass ein versehentlicher Import in Client-Code den Build fehlschlagen
lässt) und darf niemals mit `NEXT_PUBLIC_` präfixiert oder an den Browser gesendet
werden.

### SerpApi Key (für "Kontakt vervollständigen")

1. Auf [serpapi.com](https://serpapi.com) registrieren (kostenlose Stufe: 250 Suchen/Monat).
2. Im Dashboard unter **Your Account → API Key** den Key kopieren.
3. Als `SERPAPI_KEY` in `.env.local` eintragen.

Ohne diesen Key funktioniert die App normal weiter, nur der "Kontakt vervollständigen"-Button
zeigt dann eine Fehlermeldung an.

### VAPID-Schlüssel (für Push-Benachrichtigungen der Team-App)

Einmalig erzeugen:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

`publicKey` als `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `privateKey` als `VAPID_PRIVATE_KEY`
in `.env.local` eintragen. Ohne diese Keys funktioniert die Team-App weiter (Anfragen
lassen sich manuell in der App bestätigen), nur Push-Benachrichtigungen bleiben aus.

### Proberaum-Kalender-Link (optional, siehe Abschnitt "Kalender")

Öffentlichen CalDAV/iCal-Export-Link des Proberaum-Belegungskalenders als
`PROBERAUM_ICAL_URL` in `.env.local` eintragen. Ohne diesen Wert funktioniert
die App normal weiter, nur die zusätzlichen "Proberaum belegt"-Einträge im
Kalender bleiben aus.

## 4. Lokal starten

```bash
npm install
npm run dev
```

App läuft dann unter [http://localhost:3000](http://localhost:3000).

## Projektstruktur

```
src/
  app/
    page.tsx              Dashboard
    venues/page.tsx        Veranstalter-Übersicht (Filter, Suche)
    venues/new/page.tsx     Veranstalter anlegen
    venues/[id]/page.tsx    Veranstalter-Detail/Bearbeiten
    venues/suche/page.tsx   Neue Veranstalter finden (Google-Maps-Suche)
    pipeline/page.tsx       Kanban-Pipeline (Drag & Drop)
    bands/page.tsx           Bands-Übersicht
    bands/[id]/page.tsx      Band-Stammdaten, E-Mail & Materialien (Stage Rider, EPK, YouTube, ...)
  components/               UI-Komponenten (Nav, BandSwitcher, VenueForm, VenueSucheForm, BandForm, BandEmailSection, KanbanBoard, ...)
  lib/
    supabase.ts             Supabase-Client (anon-Key)
    supabaseAdmin.ts          Supabase-Client (service_role-Key, nur serverseitig, server-only-Guard)
    database.types.ts       Handgeschriebene DB-Typen (siehe Hinweis unten)
    queries.ts               Datenzugriff & Filter-/Statistik-Logik
    actions.ts                Server Actions (Create/Update/Delete Venue, Status-Update, Kontakt-/Veranstalter-Recherche, Band-Materialien)
    emailActions.ts            Server Actions für Band-E-Mail (Einstellungen, Senden via SMTP, Empfangen via IMAP)
    constants.ts               Status-Pipeline, Veranstalter-Typen, Band-Material-Typen, Farben
supabase/
  migrations/0001_init.sql   DB-Schema
  migrations/0002_open_policies.sql  RLS-Policies (offen, Single-User-MVP)
  migrations/0003_band_materialien.sql  Band-Materialliste
  migrations/0004_band_email.sql  Band-E-Mail-Zugangsdaten & -Verlauf
  migrations/0005_band_emails_venue.sql  E-Mail-Verlauf ↔ Veranstalter-Verknüpfung
  seed.sql                    Beispieldaten
```

### Hinweis zu `database.types.ts`

Die Typen wurden von Hand passend zur Migration geschrieben (kein Supabase-Projekt
lag beim Erstellen vor). Sobald das Projekt läuft, können sie bei Bedarf mit
folgendem Befehl automatisch aus der echten DB generiert werden:

```bash
npx supabase gen types typescript --project-id <dein-projekt-ref> > src/lib/database.types.ts
```

## Datenmodell

- **bands** – Stammdaten der beiden Bands (Genre, Gagenrahmen, Kontakt, EPK-Link).
- **band_materialien** – freie Titel+Link-Liste pro Band (Stage Rider, EPK, YouTube, Fotos, ...).
- **venues** – Veranstalter (Locations, Festivals, Stadtfeste, Clubs, ...).
- **venue_band_status** – n:m-Verknüpfung Band↔Veranstalter mit Status-Pipeline
  (`neu → recherchiert → kontaktiert → nachgefasst → interessiert → abgesagt/gebucht`)
  und Zeitstempeln für letzten Kontakt / nächsten Follow-up.

`user_id`-Spalten auf `bands` und `venues` sind für spätere Mehrbenutzerfähigkeit
vorbereitet. RLS ist aktiv, aber (Single-User-MVP, kein Login) mit bewusst offenen
Policies für `anon`/`authenticated` (siehe `0002_open_policies.sql`).

## Kontakt vervollständigen

Auf der Veranstalter-Detailseite füllt der Button "Kontakt vervollständigen" per
[SerpApi](https://serpapi.com) (Google-Suche über Name + Ort) automatisch die
Felder Website/Telefon, sofern sie leer sind. Adresse, Quelle und ein Textausschnitt
werden zusätzlich in die Notizen geschrieben, da Ansprechpartner/E-Mail sich aus
einer generischen Suche nicht zuverlässig extrahieren lassen – die Werte müssen
manuell geprüft und ggf. übernommen werden, bevor gespeichert wird. Läuft nur auf
Knopfdruck (ein API-Call pro Klick), um das kostenlose Kontingent zu schonen.

## Neue Veranstalter finden

Unter "Suche" (`/venues/suche`) durchsucht die App per SerpApi nach Ort (Pflicht),
optional Typ und zusätzlichen Suchbegriffen:

- **Typ festgelegt** (Club/Firmenevent/Hochzeit/Sonstiges) → Google Maps (feste
  Locations: Adresse, Kategorie, Bewertung, Telefon, Website).
- **Typ festgelegt** (Festival/Stadtfest) → Google Events (datierte Veranstaltungen:
  Termin, Venue, Adresse). Findet Google Events nichts (häufig bei kleineren/
  wiederkehrenden Stadtfesten, z. B. kostenlose wöchentliche Reihen ohne
  Ticketverkauf), fällt die Suche automatisch auf eine normale Websuche zurück.
- **Kein Typ festgelegt** ("Alle Typen", Standard – z. B. wenn man eine gesehene
  Veranstaltung gezielt sucht und die Kategorie noch nicht kennt) → Google Events,
  Google Maps und Websuche laufen parallel, Treffer werden kombiniert angezeigt.
  Pro Treffer wird danach automatisch eine passende Kategorie vorgeschlagen
  (editierbar), bevor man ihn anlegt.

In allen Websuche-Fällen stehen Termine/Details ggf. nur als Text im Ausschnitt,
nicht strukturiert. Aus jedem Treffer lässt sich per Klick ein neuer Veranstalter
anlegen (Website/Telefon werden übernommen, Termin/Adresse/Kategorie/Bewertung/
Ausschnitt landen in den Notizen). Bereits vorhandene Veranstalter mit demselben
Namen werden nicht doppelt angelegt, sondern verlinkt. Kosten pro Suche: 1 API-Call
mit festem Typ (ggf. +1 bei Fallback), bis zu 3 ohne festen Typ.

## Bands & Materialien

Unter "Bands" (`/bands`) lassen sich die Stammdaten beider Bands bearbeiten (Genre,
Gagenrahmen, Kontakt-E-Mail, EPK-Link) sowie eine freie Materialliste pflegen:
beliebig viele Einträge aus Titel + Link + optionalem Typ (Stage Rider, EPK,
YouTube, Fotos, Social Media, Sonstiges). Bewusst als Link-Liste statt Datei-Upload,
damit kein zusätzliches Storage-Setup nötig ist – Links zu Google Drive, Dropbox,
YouTube etc. reichen.

## E-Mail (Versand & Empfang)

Auf der Band-Seite, zwischen den Stammdaten und den Materialien, lässt sich pro
Band ein eigenes E-Mail-Postfach anbinden (z. B. `booking@90er-coverband.de`):

- **E-Mail-Einstellungen** (eingeklappt hinter einem Button): Absender-Name,
  E-Mail-Adresse, Passwort, SMTP-Host/Port/SSL (Versand) und IMAP-Host/Port/SSL
  (Empfang) – freie Eingabe passend zu eurem E-Mail-Hoster (z. B. IONOS:
  `smtp.ionos.de` Port 587 ohne SSL-Haken = STARTTLS, `imap.ionos.de` Port 993
  mit SSL-Haken). Passwort wird beim erneuten Speichern beibehalten, wenn das
  Feld leer gelassen wird.
- **Veranstalter-Dropdown (optional)**: wählt man einen der Band zugeordneten
  Veranstalter aus, wird "An" automatisch mit dessen E-Mail-Adresse befüllt und
  die gesendete E-Mail wird diesem Veranstalter zugeordnet.
- **Compose-Feld**: An/Betreff/Nachricht, Versand per SMTP ([nodemailer](https://nodemailer.com)).
- **Verlauf**: gesendete E-Mails erscheinen automatisch; über "Postfach
  aktualisieren" werden neue eingegangene E-Mails per IMAP ([imapflow](https://imapflow.com)
  + [mailparser](https://nodemailer.com/extras/mailparser/)) abgerufen und
  ergänzt (Duplikate werden anhand der IMAP-UID erkannt, Zuordnung zum
  Veranstalter automatisch anhand der Von-Adresse). Kein automatisches
  Hintergrund-Polling – Abruf passiert nur auf Knopfdruck.

### Zuordnung zu Veranstaltern

Jede E-Mail (gesendet oder empfangen) wird automatisch einem Veranstalter
zugeordnet, wenn dessen hinterlegte E-Mail-Adresse mit Empfänger (Senden) bzw.
Absender (Empfangen) übereinstimmt – oder manuell über das Veranstalter-Dropdown
beim Senden. Die Zuordnung ist doppelt sichtbar:

- Auf der **Band-Seite** im Verlauf als Link zum jeweiligen Veranstalter.
- Auf der **Veranstalter-Seite** als eigener Abschnitt "E-Mail-Verlauf" (über
  alle Bands hinweg). Bei verknüpften Bands erscheint dort außerdem ein
  "E-Mail schreiben"-Link, der direkt zur passenden Band-Seite springt und
  Empfänger + Veranstalter im Compose-Formular vorausfüllt.

### Sicherheitshinweis

Das E-Mail-Passwort liegt im Klartext in der Tabelle `band_email_konten` (keine
App-seitige Verschlüsselung). Schutz erfolgt ausschließlich dadurch, dass diese
Tabelle **keine RLS-Policy für `anon`/`authenticated`** hat – nur der
`service_role`-Key (serverseitig, nie im Browser) kann sie lesen/schreiben. Für
mehr Sicherheit könnte man zusätzlich ein E-Mail-Konto mit eigenem
App-Passwort verwenden (falls der Hoster das anbietet) statt des Hauptpassworts.

## Kalender

Unter "Kalender" (`/kalender`) gibt es eine Monats- und eine Jahresansicht aller
Veranstalter mit Status "gebucht" oder "interessiert" und gesetztem
Veranstaltungsdatum. Farben sind pro Band fest zugeordnet (kräftig = gebucht,
deutlich heller = interessiert), damit auf einen Blick erkennbar ist, welcher
Termin zu welcher Band gehört. In der Jahresansicht führt ein Klick auf einen
Tag/Monat direkt in die Monatsansicht.

### Proberaum-Kalender (optional)

Ist `PROBERAUM_ICAL_URL` gesetzt (öffentlicher CalDAV/iCal-Export, z. B. ein
Nextcloud-Freigabelink), werden Belegungstermine des Proberaums als neutrale
"Proberaum belegt"-Einträge zusätzlich in beiden In-App-Kalendern angezeigt
(Desktop unter `/kalender` für beide Bands, sowie im Kalender-Tab der
Team-App) - Details zum jeweiligen Termin stehen im Tooltip. Der Feed wird
serverseitig eine Stunde lang gecacht, nicht bei jedem Seitenaufruf neu
abgerufen. Bewusst **nicht** enthalten im privaten `.ics`-Kalender-Abo der
Bands (`/api/kalender/<band-id>`) - der bleibt reine Gig-Übersicht.

## Team-App (Verfügbarkeitsabfrage per Push)

Eine bewusst von der Verwaltungsoberfläche getrennte, stark reduzierte
Progressive-Web-App unter `/team/<band-id>` für Band-Mitglieder – kein Zugriff
auf Veranstalter, E-Mails, Suche oder Pipeline, nur Kalender + Verfügbarkeit
bestätigen.

- **Einladung**: Auf der Band-Seite (`/bands/<id>`) gibt es einen QR-Code und
  einen kopierbaren Link zur Team-App der jeweiligen Band.
- **Registrierung ohne Login**: Beim ersten Öffnen wird einmalig der Name
  abgefragt (lokal auf dem Gerät gespeichert, kein Passwort) und – sofern
  erlaubt – eine Web-Push-Subscription eingerichtet. Wird Push abgelehnt oder
  ist der Browser nicht unterstützt (z. B. iOS < 16.4 ohne "Zum
  Home-Bildschirm hinzufügen"), bleibt die Seite trotzdem manuell nutzbar.
- **Automatischer Auslöser**: Sobald eine Band<->Veranstalter-Beziehung
  (automatisch durch E-Mail-Erkennung oder manuell) auf Status "interessiert"
  wechselt, geht sofort eine Push-Anfrage an alle Mitglieder der betroffenen
  Band. Die beiden Action-Buttons "Ich kann"/"Ich kann nicht" auf der
  Benachrichtigung selbst senden die Antwort direkt aus dem Hintergrund
  (Service Worker), ohne dass die App geöffnet werden muss.
- **Status**: Haben alle Mitglieder "Ich kann" bestätigt, wird das auf
  Dashboard und Kontakt-Detailseite als "✓ Alle bestätigt – bereit für
  Buchung" markiert. Eine einzelne Absage wird sofort rot markiert, blockiert
  aber nichts automatisch – die eigentliche Buchung (Status "gebucht") bleibt
  eine bewusste manuelle Entscheidung.
- **Kalender-Abo**: Pro Band gibt es einen `.ics`-Feed
  (`/api/kalender/<band-id>`) zum Abonnieren in privaten Kalender-Apps (Apple
  Kalender, Google Kalender, Outlook) mit denselben Terminen wie die
  In-App-Kalenderansicht. Kalender-Apps aktualisieren Abos in eigenem Takt
  (meist alle paar Stunden, kein Echtzeit-Sync) – die Push-Benachrichtigung
  für Anfragen ist davon unabhängig und weiterhin sofort.
- **Mitgliederverwaltung**: Auf der Band-Seite können registrierte Mitglieder
  entfernt werden (z. B. bei Bandwechsel oder Doppel-Registrierung).

## Deployment

- **Frontend/API:** [Vercel](https://vercel.com/new) – Projekt importieren, die
  `NEXT_PUBLIC_SUPABASE_*`-, `SUPABASE_SERVICE_ROLE_KEY`-, `SERPAPI_KEY`-,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`- sowie optional
  `PROBERAUM_ICAL_URL`-Variablen in den Projekteinstellungen hinterlegen.
- **Datenbank:** bleibt bei Supabase (kostenlose Stufe).

## Bewusst nicht im MVP-Scope

(Datenmodell ist darauf vorbereitet, aber nicht implementiert)

- Vollautomatischer Import von Suchtreffern (aktuell nur manuell angestoßene Suche + Auswahl, kein automatisches Massen-Anlegen)
- Automatisches Hintergrund-Polling neuer E-Mails (nur manueller Abruf per Knopfdruck)
- Automatisiertes Follow-up (z. B. automatischer Mahn-/Erinnerungsversand)
- E-Mail-Vorlagen (z. B. für automatische Absage-Mails) und Angebotserstellung
- Vertrags-/Angebotserstellung (PDF)
- Mehrbenutzer-Login-UI
