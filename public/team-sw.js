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
      anfrageId: payload.anfrageId,
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
  const { anfrageId, mitgliedId, bandId } = event.notification.data || {};
  event.notification.close();

  if (event.action === "kann" || event.action === "kann_nicht") {
    event.waitUntil(
      fetch("/api/team-antwort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anfrageId,
          mitgliedId,
          antwort: event.action,
        }),
      }).catch(() => {
        // Offline o. Ä. - die Antwort geht verloren, die Person sieht die
        // Anfrage beim nächsten App-Öffnen weiterhin als offen.
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
