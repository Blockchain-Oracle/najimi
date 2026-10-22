"use client"

/*
 * Web Push in the browser (W24): the service worker, the install prompt Chrome offers, and the
 * subscription the worker pushes to. iPhones only take push once Najimi is on the Home Screen.
 */

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

const g = globalThis as unknown as { najimiInstall?: InstallPrompt | null }

/** Registers the worker and keeps Chrome's install offer for when they ask. */
export function startPush() {
  if (typeof window === "undefined") return
  if ("serviceWorker" in navigator)
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined)
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    g.najimiInstall = e as InstallPrompt
    window.dispatchEvent(new Event("najimi:installable"))
  })
}

export const installPrompt = () => g.najimiInstall ?? null

export async function install() {
  const prompt = g.najimiInstall
  if (!prompt) return false
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  g.najimiInstall = null
  return outcome === "accepted"
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true)

export const isIos = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent)

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window

const keyBytes = (base64url: string) => {
  const raw = atob(base64url.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Asks for permission and subscribes this browser; returns false when they said no. */
export async function subscribe(publicKey: string) {
  if (!pushSupported()) return false
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return false
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    }))
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  })
  return res.ok
}

export async function unsubscribe() {
  const sub = await currentSubscription()
  if (!sub) return
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => undefined)
  await sub.unsubscribe().catch(() => undefined)
}
