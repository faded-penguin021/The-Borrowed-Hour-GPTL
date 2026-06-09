// The Borrowed Hour — service worker.
//
// Purpose: make the app installable as a PWA. That's the whole job. We do NOT
// pretend to work offline: the story cannot exist without the network (the LLM,
// image, and TTS providers are all remote and cross-origin), so an "offline"
// shell would just be the twilight theme with no gameplay. We refuse to ship
// that. Open the app online or not at all.
//
// To stay installable across browsers we register a fetch handler, but it is a
// deliberate pass-through: every request goes straight to the network and we
// cache nothing. There is no offline fallback by design.
//
// Earlier versions of this worker DID precache the shell. The activate handler
// below evicts those caches so upgrading clients stop serving a stale,
// non-functional offline shell.
const CACHE_PREFIX = "borrowed-hour-";

self.addEventListener("install", () => {
  // Nothing to precache; take over as soon as possible.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Present so the worker satisfies PWA install criteria, but intentionally inert:
// we never call respondWith, so the browser handles every request normally and
// nothing is served from a cache. No offline behaviour.
self.addEventListener("fetch", () => {});
