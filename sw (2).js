/* Must live on YOUR origin (same folder as index.html). Pull the heavy code from jsDelivr. */
importScripts("https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@1.0.2-dev/dist/scramjet.all.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(clients.claim()));
self.addEventListener("fetch", e => e.respondWith((async () => {
  await scramjet.loadConfig();
  if (scramjet.route(e)) return scramjet.fetch(e);
  return fetch(e.request);
})()));
