/* Must sit in the same folder as lightspeed.svg, on the same host. */
const SCRAMJET = "https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@1.1.0/dist/";

/* Default page, used if the SVG does not pass one. The SVG normally passes it as ?src= */
const APP_SRC = "https://cdn.jsdelivr.net/gh/mathissofun137/Proxy@main/index.html";
/* ?src= is only honoured for jsDelivr files under this prefix, so nobody can use a crafted link
   to make your site serve someone else's HTML. */
const ALLOWED_HOSTS = ["cdn.jsdelivr.net", "fastly.jsdelivr.net", "gcore.jsdelivr.net", "testingcf.jsdelivr.net"];
const ALLOWED_PREFIX = "/gh/mathissofun137/";
function pickSrc(param) {
  try {
    const u = new URL(param);
    if (u.protocol === "https:" && ALLOWED_HOSTS.includes(u.hostname) && u.pathname.startsWith(ALLOWED_PREFIX)) return u.href;
  } catch (_) {}
  return APP_SRC;
}
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
async function serveApp(param) {
  const src = pickSrc(param);
  const key = "app:" + src;
  const cache = await caches.open("relay-app");
  try {
    const r = await fetch(src + (src.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status + " fetching " + src);
    const html = await r.text();
    const res = new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    cache.put(key, res.clone());
    return res;
  } catch (err) {
    const old = await cache.match(key);
    return old || diag(err && err.message || err);
  }
}

const appPath = new URL(APP_NAME, self.registration.scope).pathname;

self.addEventListener("fetch", e => e.respondWith((async () => {
  try {
    const u = new URL(e.request.url);

    /* Anything on another origin (the jsDelivr scripts, transports, fonts...) goes straight to the network.
       Without this, the page's own script loads are answered with an error until Scramjet has saved its config. */
    if (u.origin !== location.origin) return await fetch(e.request);

    if (u.pathname === appPath) return await serveApp(u.searchParams.get("src"));

    await scramjet.loadConfig();
    if (!scramjet.config) {
      /* Config not saved yet: only proxied pages need it, everything else (sw.js, bm-worker.js...) can pass through. */
      if (u.pathname.startsWith(new URL("sj/", self.registration.scope).pathname))
        return diag("Scramjet config is missing from IndexedDB. Reload the page once.");
      return await fetch(e.request);
    }
    if (scramjet.route(e)) return await scramjet.fetch(e);
    return await fetch(e.request);
  } catch (err) {
    return diag((err && err.stack) || err);
  }
})()));
