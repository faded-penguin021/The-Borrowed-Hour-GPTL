// The Borrowed Hour — service worker.
//
// Goal: make the app installable and let its shell open offline. The story
// itself needs the network (LLM, image, and TTS providers are all remote and
// cross-origin), so we deliberately do NOT touch cross-origin requests — they
// pass straight through to the network and the app's existing error handling
// covers failures. We only cache the same-origin shell (HTML, hashed JS/CSS,
// icons, fonts served from our own origin).
//
// Strategy:
//   • navigations  → network-first, fall back to the cached shell when offline
//   • same-origin GET assets → stale-while-revalidate
//   • everything else (cross-origin, non-GET) → untouched
//
// Bump CACHE_VERSION to force old caches out on the next activation.
const CACHE_VERSION = "v2";
const CACHE = `borrowed-hour-${CACHE_VERSION}`;

// Stable shell entries. Hashed build assets are not listed (their names change
// every build); they get picked up by the runtime stale-while-revalidate path.
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Tolerate individual misses (e.g. an icon renamed) — install must not
      // fail wholesale, or the SW never takes control.
      Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isHTML = (request) =>
  request.mode === "navigate" ||
  (request.headers.get("accept") || "").includes("text/html");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Leave cross-origin traffic (APIs, fonts, image/TTS providers) alone.
  if (url.origin !== self.location.origin) return;

  if (isHTML(request)) {
    // Network-first so a fresh deploy is seen immediately; cached shell is the
    // offline fallback.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (hit) => hit || caches.match("./index.html").then((idx) => idx || caches.match("./"))
          )
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === "basic") {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
