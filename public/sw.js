/**
 * Quizen service worker — minimal but useful.
 *
 * Strategy:
 *   - Precache the shell (landing, login, pricing, offline) on install.
 *   - HTML navigations: network-first, fall back to cached version,
 *     fall back to /offline if both fail.
 *   - Static assets (/_next/static, /icons): cache-first, populate
 *     lazily on miss.
 *   - API + auth routes: never intercepted (always live network).
 *
 * Bump CACHE_NAME when you change cached URLs or expect stale clients —
 * the activate step deletes old caches.
 */

const CACHE_NAME = "quizen-shell-v4";

const SHELL_URLS = [
  "/",
  "/login",
  "/pricing",
  "/account",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch((err) => console.warn("[sw] precache failed:", err)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Never intercept API or auth — these must hit the network live.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // HTML navigations: network-first with offline fallback.
  const isHtmlNavigation =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  if (isHtmlNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/offline")),
        ),
    );
    return;
  }

  // Static assets: cache-first.
  const isStatic =
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest";

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch(() => {});
          }
          return response;
        });
      }),
    );
  }
});

// ─── Web Push (Sprint 13b) ────────────────────────────────────────────
// Cron sends { title, body, url } as the payload. We render a native
// notification and route clicks to the embedded url (default /review).
self.addEventListener("push", (event) => {
  let payload = { title: "Quizen", body: "Tenés contenido para repasar." };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      tag: "quizen-reminder",
      renotify: false,
      data: { url: payload.url || "/review" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/review";

  // Focus an existing tab if any; otherwise open a new one. This avoids
  // stacking duplicate tabs every time the user taps a notification.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(targetUrl).catch(() => {});
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
