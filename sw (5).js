/* Must live on YOUR origin (same folder as index.html). Heavy code comes from jsDelivr. */
const SCRAMJET = "https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@1.1.0/dist/";

/* Scramjet looks for its .wasm on your own origin and injects it into proxied pages.
   Redirect that one path to jsDelivr so you don't have to host the binary. */
const realFetch = self.fetch.bind(self);
self.fetch = (input, init) => {
  const u = new URL(typeof input === "string" ? input : input.url, location.href);
  if (u.origin === location.origin && u.pathname.endsWith("/scramjet.wasm.wasm"))
    return realFetch(SCRAMJET + "scramjet.wasm.wasm");
  return realFetch(input, init);
};

importScripts(SCRAMJET + "scramjet.all.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(clients.claim()));
function diag(msg){
  return new Response('<pre style="white-space:pre-wrap;font:13px monospace;padding:16px">Proxy service worker error:\n\n'+String(msg).replace(/</g,"&lt;")+'</pre>',
    {status:500,headers:{"content-type":"text/html"}});
}
self.addEventListener("fetch", e => e.respondWith((async () => {
  try {
    await scramjet.loadConfig();
    if (!scramjet.config) return diag("Scramjet config is missing from IndexedDB. Open the main page once so it can write it, then retry.");
    if (scramjet.route(e)) return await scramjet.fetch(e);
    return await fetch(e.request);
  } catch (err) {
    return diag((err && err.stack) || err);
  }
})()));
