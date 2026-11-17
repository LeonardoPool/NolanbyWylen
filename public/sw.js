// NOLAN by WYLEN - Service Worker Seguro
// Cumple con la normativa LFT: No almacena en caché marcajes ni datos sensibles.

const CACHE_NAME = "nolan-static-v2";

// Solo assets estáticos e inmutables del cascarón de ambas aplicaciones (Admin y Checador)
const STATIC_ASSETS = [
  "/",
  "/isotipo-nolan.png",
  "/manifest-admin.webmanifest",
  "/manifest-checador.webmanifest",
  "/manifest.webmanifest",
  "/icons/admin-192.png",
  "/icons/admin-512.png",
  "/icons/admin-maskable-512.png",
  "/icons/admin-apple-touch-icon.png",
  "/icons/checador-192.png",
  "/icons/checador-512.png",
  "/icons/checador-maskable-512.png",
  "/icons/checador-apple-touch-icon.png",
  "/apple-touch-icon.png",
];

// Instalación
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activación y limpieza de versiones obsoletas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Estrategia de Fetch Segura
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Solo interceptar peticiones GET
  if (request.method !== "GET") {
    return;
  }

  // 2. EXCLUSIONES ESTRICTAS (Nunca almacenar en caché):
  // - Supabase (datos de BD, autenticación y sesiones)
  // - Server Actions y APIs internas
  // - Google Maps / Places API
  // - Rutas de marcaje y checador
  const isSupabase = url.hostname.includes("supabase.co");
  const isInternalApi = url.pathname.startsWith("/api");
  const isNextData = url.searchParams.has("_rsc");
  const isGoogleMaps =
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com");

  if (isSupabase || isInternalApi || isNextData || isGoogleMaps) {
    // Red directa incondicional
    return;
  }

  // 3. Rutas dinámicas y operativas (Network-First estricto sin almacenar respuestas dinámicas)
  const isOperationalRoute =
    url.pathname.startsWith("/checador") ||
    url.pathname.startsWith("/asistencias") ||
    url.pathname.startsWith("/incidencias") ||
    url.pathname.startsWith("/vacaciones") ||
    url.pathname.startsWith("/reportes") ||
    url.pathname.startsWith("/empleados") ||
    url.pathname.startsWith("/configuracion");

  if (isOperationalRoute) {
    // Las operaciones requieren red real para garantizar inmutabilidad y hora legal exacta
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          return new Response(
            JSON.stringify({
              error: "Sin conexión de red. Se requiere conexión activa para sincronizar asistencias e incidencias.",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          );
        });
      })
    );
    return;
  }

  // 4. Assets Estáticos (JS compilado, CSS, Fuentes, Iconos, Manifiestos): Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/isotipo-nolan.png" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/manifest-admin.webmanifest" ||
    url.pathname === "/manifest-checador.webmanifest" ||
    url.pathname === "/manifest.webmanifest";

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 5. Navegación general de páginas HTML: Network-First respetando scope independiente
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (url.pathname.startsWith("/checador")) {
            return (
              caches.match("/checador") ||
              new Response(
                "<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Sin Conexión | NOLAN Checador</title><style>body{font-family:sans-serif;background:#09090b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center}p{color:#a1a1aa;font-size:14px}</style></head><body><div><h2>Sin Conexión de Red</h2><p>El portal de asistencia requiere conexión activa a internet para verificar la hora legal de Mérida y geocercas GPS.</p></div></body></html>",
                {
                  status: 503,
                  headers: { "Content-Type": "text/html; charset=utf-8" },
                }
              )
            );
          }
          return caches.match("/");
        });
      })
    );
  }
});
