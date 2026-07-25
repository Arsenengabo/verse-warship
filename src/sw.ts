/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

precacheAndRoute(self.__WB_MANIFEST || []);

registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" &&
    !url.pathname.startsWith("/~oauth") &&
    !url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "verse-html",
    networkTimeoutSeconds: 4,
    plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  }),
);

registerRoute(
  ({ url, sameOrigin }) => sameOrigin && /\.(?:js|css|woff2)$/.test(url.pathname),
  new CacheFirst({
    cacheName: "verse-assets",
    plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

registerRoute(
  ({ url, sameOrigin }) => sameOrigin && /\.(?:png|svg|ico|webp|jpg|jpeg)$/.test(url.pathname),
  new CacheFirst({
    cacheName: "verse-images",
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

registerRoute(
  ({ url }) =>
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "verse-fonts",
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);

// ---- Web Push ----
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; verseId?: string; url?: string } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Verse", body: event.data.text() };
  }
  const title = payload.title ?? "Today's Verse";
  const options: NotificationOptions = {
    body: payload.body ?? "",
    icon: "/icon-512.png",
    badge: "/icon-512.png",
    tag: "verse-notification",
    data: { url: payload.url ?? "/", verseId: payload.verseId },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => "focus" in c) as WindowClient | undefined;
      if (existing) {
        await existing.focus();
        await existing.navigate(targetUrl);
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event: any) => {
  event.waitUntil(
    (async () => {
      const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const allClients = await self.clients.matchAll({ type: "window" });
      allClients.forEach((c) =>
        c.postMessage({ type: "PUSH_SUBSCRIPTION_REFRESHED", subscription: newSub.toJSON() }),
      );
    })(),
  );
});