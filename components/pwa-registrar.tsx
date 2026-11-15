"use client";

import { useEffect } from "react";

/**
 * Registra silenciosamente el Service Worker de la PWA en el navegador.
 * Solo opera en conexiones seguras (HTTPS o localhost).
 */
export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]";

    if (window.location.protocol === "https:" || isLocalhost) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .catch((err) => {
            console.warn("NOLAN PWA: Aviso al registrar el Service Worker:", err);
          });
      });
    }
  }, []);

  return null;
}
