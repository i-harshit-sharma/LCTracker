/**
 * sw.js — LeetCode Sync Hub Service Worker
 *
 * Handles incoming Web Push events and notification click actions.
 * Kept minimal — no caching strategy here, just push + click.
 */

/* eslint-disable no-restricted-globals */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through fetch (required for PWA status)
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "LeetCode Sync Hub", body: event.data.text() };
  }

  const title = payload.title ?? "LeetCode Sync Hub";
  const options = {
    body: payload.body ?? "",
    icon: payload.icon ?? "/logo.svg",
    badge: "/logo.svg",
    data: { url: payload.url ?? "https://leetcode.com/" },
    tag: "lc-solve-notification", // collapse multiple into one banner
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If the problem URL is already open in a tab, focus it
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
