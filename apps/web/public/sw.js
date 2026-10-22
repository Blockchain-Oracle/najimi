/*
 * Najimi's service worker (W24): it shows the news Najimi pushes (a message in a circle, a game
 * about you, a plan that changed) and opens the right screen when it's tapped. Nothing is cached
 * here: the app is always the live one. A push that arrives while Najimi is open and in front is
 * left to the app, which already shows it.
 */

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let note = {}
  try {
    note = event.data ? event.data.json() : {}
  } catch {
    note = { title: "Najimi", body: event.data ? event.data.text() : "" }
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      if (wins.some((w) => w.visibilityState === "visible" && w.focused)) return
      return self.registration.showNotification(note.title || "Najimi", {
        body: note.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        image: note.image || undefined,
        tag: note.tag || undefined,
        renotify: Boolean(note.tag),
        data: { url: note.url || "/" },
      })
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) return open.navigate(url).then((w) => (w || open).focus())
      return self.clients.openWindow(url)
    }),
  )
})
