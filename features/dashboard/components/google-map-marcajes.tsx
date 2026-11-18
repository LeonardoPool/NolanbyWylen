"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Loader2,
  ExternalLink,
  Navigation,
  Building2,
  AlertCircle,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventoMarcajeDetalle } from "../actions";

interface GoogleMapMarcajesProps {
  eventoEntrada?: EventoMarcajeDetalle;
  eventoSalida?: EventoMarcajeDetalle;
  configTaller: {
    nombreTaller: string;
    latitud: number;
    longitud: number;
  };
}

declare global {
  interface Window {
    google?: any;
    __initGoogleMapsDashboard?: () => void;
  }
}

export function GoogleMapMarcajes({
  eventoEntrada,
  eventoSalida,
  configTaller,
}: GoogleMapMarcajesProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "AIzaSyDTWIUl2XbrZmEbxu3TC6Js_LwfLmSZ_mo";

  // Cargar SDK oficial de Google Maps si no está presente en window
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }

    const scriptId = "google-maps-script";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existingScript) {
      if (window.google?.maps) {
        setMapLoaded(true);
      } else {
        existingScript.addEventListener("load", () => setMapLoaded(true));
      }
      return;
    }

    window.__initGoogleMapsDashboard = () => {
      setMapLoaded(true);
    };

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=marker&callback=__initGoogleMapsDashboard`;
    script.async = true;
    script.defer = true;

    script.onerror = () => {
      setLoadError("No se pudo cargar la API de Google Maps.");
    };

    document.head.appendChild(script);

    return () => {
      delete window.__initGoogleMapsDashboard;
    };
  }, [apiKey]);

  // Inicializar o actualizar el mapa con los pines reales de Entrada y Salida
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || !window.google?.maps) return;

    // Coordenadas base
    const latTaller = Number(configTaller.latitud) || 19.432608;
    const lngTaller = Number(configTaller.longitud) || -99.133209;

    const latEntrada = eventoEntrada?.latitud !== undefined ? Number(eventoEntrada.latitud) : null;
    const lngEntrada = eventoEntrada?.longitud !== undefined ? Number(eventoEntrada.longitud) : null;

    const latSalida = eventoSalida?.latitud !== undefined ? Number(eventoSalida.latitud) : null;
    const lngSalida = eventoSalida?.longitud !== undefined ? Number(eventoSalida.longitud) : null;

    // Determinar centro inicial
    const centroInicial =
      latEntrada !== null && lngEntrada !== null
        ? { lat: latEntrada, lng: lngEntrada }
        : { lat: latTaller, lng: lngTaller };

    // Si aún no existe la instancia del mapa, crearla
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: centroInicial,
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: "cooperative",
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });
    }

    const map = mapInstanceRef.current;

    // Limpiar marcadores y polilínea anteriores
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const bounds = new window.google.maps.LatLngBounds();

    // 1. Marcador del Taller Central
    const tallerMarker = new window.google.maps.Marker({
      position: { lat: latTaller, lng: lngTaller },
      map,
      title: configTaller.nombreTaller,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#2563EB",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
      },
    });

    const infoTaller = new window.google.maps.InfoWindow({
      content: `
        <div style="font-family: sans-serif; font-size: 11px; padding: 2px;">
          <b style="color: #2563EB;">🏢 ${configTaller.nombreTaller}</b><br/>
          <span>Base Operativa</span>
        </div>
      `,
    });
    tallerMarker.addListener("click", () => infoTaller.open(map, tallerMarker));
    markersRef.current.push(tallerMarker);
    bounds.extend({ lat: latTaller, lng: lngTaller });

    // 2. Marcador de Entrada (Verde con etiqueta E)
    if (latEntrada !== null && lngEntrada !== null) {
      const entradaMarker = new window.google.maps.Marker({
        position: { lat: latEntrada, lng: lngEntrada },
        map,
        title: `Entrada: ${eventoEntrada?.hora}`,
        label: {
          text: "E",
          color: "#FFFFFF",
          fontWeight: "bold",
          fontSize: "11px",
        },
        icon: {
          path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#059669",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
      });

      const infoEntrada = new window.google.maps.InfoWindow({
        content: `
          <div style="font-family: sans-serif; font-size: 11px; padding: 3px;">
            <b style="color: #059669;">🟢 ENTRADA: ${eventoEntrada?.hora}</b><br/>
            <span>${eventoEntrada?.lugarAutorizado || configTaller.nombreTaller}</span><br/>
            <small style="color: #64748B;">Distancia: ${eventoEntrada?.distanciaMetros ?? 0}m del taller</small>
          </div>
        `,
      });
      entradaMarker.addListener("click", () => infoEntrada.open(map, entradaMarker));
      markersRef.current.push(entradaMarker);
      bounds.extend({ lat: latEntrada, lng: lngEntrada });
    }

    // 3. Marcador de Salida (Rojo/Rosa con etiqueta S)
    if (latSalida !== null && lngSalida !== null) {
      const salidaMarker = new window.google.maps.Marker({
        position: { lat: latSalida, lng: lngSalida },
        map,
        title: `Salida: ${eventoSalida?.hora}`,
        label: {
          text: "S",
          color: "#FFFFFF",
          fontWeight: "bold",
          fontSize: "11px",
        },
        icon: {
          path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#E11D48",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
      });

      const infoSalida = new window.google.maps.InfoWindow({
        content: `
          <div style="font-family: sans-serif; font-size: 11px; padding: 3px;">
            <b style="color: #E11D48;">🔴 SALIDA: ${eventoSalida?.hora}</b><br/>
            <span>${eventoSalida?.lugarAutorizado || configTaller.nombreTaller}</span><br/>
            <small style="color: #64748B;">Distancia: ${eventoSalida?.distanciaMetros ?? 0}m del taller</small>
          </div>
        `,
      });
      salidaMarker.addListener("click", () => infoSalida.open(map, salidaMarker));
      markersRef.current.push(salidaMarker);
      bounds.extend({ lat: latSalida, lng: lngSalida });
    }

    // 4. Polilínea de Trayectoria entre Entrada y Salida
    if (
      latEntrada !== null &&
      lngEntrada !== null &&
      latSalida !== null &&
      lngSalida !== null &&
      (latEntrada !== latSalida || lngEntrada !== lngSalida)
    ) {
      polylineRef.current = new window.google.maps.Polyline({
        path: [
          { lat: latEntrada, lng: lngEntrada },
          { lat: latSalida, lng: lngSalida },
        ],
        geodesic: true,
        strokeColor: "#059669",
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map,
      });
    }

    // Ajustar encuadre para mostrar todos los puntos
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      // Evitar zoom excesivo si hay un solo punto
      const listener = window.google.maps.event.addListener(map, "idle", () => {
        if (map.getZoom() > 17) map.setZoom(17);
        window.google.maps.event.removeListener(listener);
      });
    }
  }, [mapLoaded, eventoEntrada, eventoSalida, configTaller]);

  // Coordenadas para enlaces externos a Google Maps
  const urlGoogleMapsEntrada =
    eventoEntrada?.latitud && eventoEntrada?.longitud
      ? `https://www.google.com/maps?q=${eventoEntrada.latitud},${eventoEntrada.longitud}`
      : `https://www.google.com/maps?q=${configTaller.latitud},${configTaller.longitud}`;

  const urlGoogleMapsSalida =
    eventoSalida?.latitud && eventoSalida?.longitud
      ? `https://www.google.com/maps?q=${eventoSalida.latitud},${eventoSalida.longitud}`
      : `https://www.google.com/maps?q=${configTaller.latitud},${configTaller.longitud}`;

  return (
    <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-2xs space-y-3 p-3.5">
      {/* Cabecera sin la palabra Geocerca */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Navigation className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-bold text-zinc-900">
            Ubicación en Google Maps
          </span>
        </div>
        <span className="text-[10px] text-zinc-400 font-mono">
          Google Maps API Oficial
        </span>
      </div>

      {/* Contenedor del Mapa Real de Google Maps */}
      <div className="relative h-48 w-full rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 flex items-center justify-center">
        <div ref={mapContainerRef} className="w-full h-full" />

        {!mapLoaded && !loadError && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-zinc-500 z-10">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            <span className="text-[10px] font-medium">Cargando Google Maps...</span>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 bg-white p-4 flex flex-col items-center justify-center text-center gap-2 text-zinc-600 z-10">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <p className="text-xs font-semibold">{loadError}</p>
            <a
              href={urlGoogleMapsEntrada}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline font-medium"
            >
              Abrir ubicación en Google Maps Web
            </a>
          </div>
        )}

        {/* Leyenda flotante discreta sobre el mapa */}
        <div className="absolute bottom-2 left-2 z-10 bg-white/95 backdrop-blur-xs px-2 py-1 rounded-lg border border-zinc-200/90 shadow-sm flex items-center gap-2 text-[9px] font-medium text-zinc-700">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            E: Entrada
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-600" />
            S: Salida
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Taller
          </span>
        </div>
      </div>

      {/* Tarjetas de Información de Entrada y Salida */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Entrada */}
        <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-emerald-700 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Lugar Entrada
            </span>
            <span className="text-[10px] font-mono text-zinc-700 font-bold">
              {eventoEntrada?.hora || "--:--"}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-zinc-900 leading-tight truncate">
            {eventoEntrada?.lugarAutorizado || configTaller.nombreTaller}
          </p>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
            <span>
              {eventoEntrada?.distanciaMetros !== undefined
                ? `${eventoEntrada.distanciaMetros}m del taller`
                : "Checador Físico"}
            </span>
            <a
              href={urlGoogleMapsEntrada}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
            >
              Ver Maps
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>

        {/* Salida */}
        <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-rose-700 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Lugar Salida
            </span>
            <span className="text-[10px] font-mono text-zinc-700 font-bold">
              {eventoSalida?.hora || "--:--"}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-zinc-900 leading-tight truncate">
            {eventoSalida?.lugarAutorizado || configTaller.nombreTaller}
          </p>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
            <span>
              {eventoSalida?.distanciaMetros !== undefined
                ? `${eventoSalida.distanciaMetros}m del taller`
                : "Checador Físico"}
            </span>
            <a
              href={urlGoogleMapsSalida}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
            >
              Ver Maps
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
