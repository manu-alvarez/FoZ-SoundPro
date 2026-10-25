/**
 * FoZ SoundPro — Service Worker para Soporte Offline PWA
 * =======================================================
 * Almacena en caché los recursos estáticos para permitir la ejecución
 * de la estación de producción musical sin conexión a Internet.
 */

const CACHE_NAME = "foz-soundpro-v1.1.4";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/constants.js",
  "./js/audio-engine.js",
  "./js/midi-engine.js",
  "./js/project-manager.js",
  "./js/sequencer.js",
  "./js/sampler.js",
  "./js/trackpad.js",
  "./js/base-library.js",
  "./js/rec-studio.js",
  "./js/ai-assistant.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/logo.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon-180.png",
];

// Instalación: Precargar recursos esenciales
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activación: Limpiar cachés antiguas si las hubiera
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Estrategia Cache First con fallback a red
self.addEventListener("fetch", (event) => {
  // Ignorar peticiones a APIs locales de Ollama / Bridge (http://127.0.0.1:*)
  const url = new URL(event.request.url);
  if (url.port === "8765" || url.port === "11434") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cachear recursos válidos
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== "basic"
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    }).catch(() => {
      // Fallback a index.html para navegación si falla la red
      if (event.request.mode === "navigate") {
        return caches.match("./index.html");
      }
    })
  );
});
