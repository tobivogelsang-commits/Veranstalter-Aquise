self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const options = {
    body: payload.body,
    data: {
      // Gig-Anfrage ODER Termin - der notificationclick-Handler unterscheidet
      // anhand von terminId, an welchen Endpunkt die Antwort geht.
      anfrageId: payload.anfrageId,
      terminId: payload.terminId,
      vorkommenDatum: payload.vorkommenDatum,
      mitgliedId: payload.mitgliedId,
      bandId: payload.bandId,
    },
    actions: [
      { action: "kann", title: "✅ Ich kann" },
      { action: "kann_nicht", title: "❌ Ich kann nicht" },
    ],
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Neue Anfrage", options)
  );
});

// Klick auf einen der beiden Action-Buttons: Antwort direkt aus dem Hintergrund
// per fetch() an den Server schicken, ohne die App zu öffnen ("1-Klick").
// Klick auf den Notification-Text selbst (keine Action): App öffnen/fokussieren.
self.addEventListener("notificationclick", (event) => {
  const { anfrageId, terminId, vorkommenDatum, mitgliedId, bandId } =
    event.notification.data || {};
  event.notification.close();

  if (event.action === "kann" || event.action === "kann_nicht") {
    // Termin-Push (terminId gesetzt) -> Vorkommen-genauer Endpunkt; sonst der
    // Gig-Anfrage-Endpunkt.
    const anfrage = terminId
      ? fetch("/api/team-termin-antwort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            terminId,
            vorkommenDatum,
            mitgliedId,
            bandId,
            antwort: event.action,
          }),
        })
      : fetch("/api/team-antwort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anfrageId,
            mitgliedId,
            antwort: event.action,
          }),
        });
    event.waitUntil(
      anfrage.catch(() => {
        // Offline o. Ä. - die Antwort geht verloren, die Person sieht den
        // Termin/die Anfrage beim nächsten App-Öffnen weiterhin als offen.
      })
    );
    return;
  }

  const ziel = bandId ? `/team/${bandId}` : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/team") && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(ziel);
        }
      })
  );
});
