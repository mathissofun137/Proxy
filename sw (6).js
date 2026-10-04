/* Must sit in the same folder as lightspeed.svg, on the same host. */
const SCRAMJET = "https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@1.1.0/dist/";

/* The proxy HTML on the CDN. Change this to wherever you upload your HTML. */
const APP_SRC = "https://fastly.jsdelivr.net/gh/mathissofun137/blooket@main/blooket1.html";
const APP_NAME = "app.html"; // the virtual address the SVG opens; no real file by this name is needed

/* Scramjet wants its .wasm on this origin; hand it the jsDelivr copy instead. */
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

function diag(msg) {
  return new Response('<pre style="white-space:pre-wrap;font:13px monospace;padding:16px;color:#ddd;background:#111">Proxy service worker error:\n\n' +
    String(msg).replace(/</g, "&lt;") + "</pre>", { status: 500, headers: { "content-type": "text/html" } });
}

/* Builds app.html from the CDN copy (jsDelivr serves HTML as plain text, so it can't be framed directly). */
async function serveApp() {
  const cache = await caches.open("relay-app");
  try {
    const r = await fetch(APP_SRC + (APP_SRC.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status + " fetching " + APP_SRC);
    const html = await r.text();
    const res = new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    cache.put("app", res.clone());
    return res;
  } catch (err) {
    const old = await cache.match("app");
    return old || diag(err && err.message || err);
  }
}

const appPath = new URL(APP_NAME, self.registration.scope).pathname;

self.addEventListener("fetch", e => e.respondWith((async () => {
  try {
    const u = new URL(e.request.url);
    if (u.origin === location.origin && u.pathname === appPath) return await serveApp();
    await scramjet.loadConfig();
    if (!scramjet.config) return diag("Scramjet config is missing from IndexedDB. Reload the page once.");
    if (scramjet.route(e)) return await scramjet.fetch(e);
    return await fetch(e.request);
  } catch (err) {
    return diag((err && err.stack) || err);
  }
})()));
