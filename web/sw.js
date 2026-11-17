// Service worker: guarda a interface do app para abrir rápido e funcionar com sinal fraco.
// Os dados (Supabase) nunca passam por aqui; sempre vêm da rede.
const CACHE = "gestao-obras-v1";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "formatos.js",
  "config.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Rede primeiro (versão mais nova); sem rede, usa a cópia guardada.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit ?? caches.match("index.html"))),
  );
});
