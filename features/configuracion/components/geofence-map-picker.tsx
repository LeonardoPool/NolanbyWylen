"use client";

import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  Loader2,
  AlertCircle,
  LocateFixed,
  Search,
  X,
  Building2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buscarLugaresGoogle,
  obtenerDetalleLugarGoogle,
  type SugerenciaLugarGoogle,
} from "../actions";

interface GeofenceMapPickerProps {
  latitud: number;
  longitud: number;
  radioMetros: number;
  onLocationChange: (lat: number, lng: number, direccionSugerida?: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    google?: any;
    __initGoogleMaps?: () => void;
  }
}

export function GeofenceMapPicker({
  latitud,
  longitud,
  radioMetros,
  onLocationChange,
  disabled = false,
}: GeofenceMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const circleInstanceRef = useRef<any>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [obteniendoGps, setObteniendoGps] = useState(false);

  // Estados del buscador integrado conectado a Google Places
  const [busquedaTexto, setBusquedaTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [buscandoDetalle, setBuscandoDetalle] = useState(false);
  const [sugerencias, setSugerencias] = useState<SugerenciaLugarGoogle[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [placesApiAviso, setPlacesApiAviso] = useState(false);
  const [enlaceActivacion, setEnlaceActivacion] = useState(
    "https://console.developers.google.com/apis/api/places.googleapis.com/overview?project=443063301097"
  );

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "AIzaSyDTWIUl2XbrZmEbxu3TC6Js_LwfLmSZ_mo";

  // Cargar SDK de Google Maps con libraries=places,marker
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    async function checkOrImportMaps(): Promise<boolean> {
      if (typeof window.google?.maps?.Map === "function") {
        return true;
      }
      if (typeof window.google?.maps?.importLibrary === "function") {
        try {
          await window.google.maps.importLibrary("maps");
          if (typeof window.google?.maps?.Map === "function") {
            return true;
          }
        } catch {
          // ignore
        }
      }
      return false;
    }

    checkOrImportMaps().then((ready) => {
      if (ready && isMounted) {
        setMapLoaded(true);
      }
    });

    const scriptId = "google-maps-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const onScriptReady = async () => {
      const ready = await checkOrImportMaps();
      if (ready && isMounted) {
        setMapLoaded(true);
      } else {
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const isReady = await checkOrImportMaps();
          if (isReady) {
            clearInterval(interval);
            if (isMounted) setMapLoaded(true);
          } else if (attempts > 30) {
            clearInterval(interval);
          }
        }, 150);
      }
    };

    window.__initGoogleMaps = () => {
      onScriptReady();
    };

    if (script) {
      checkOrImportMaps().then((ready) => {
        if (ready && isMounted) {
          setMapLoaded(true);
        } else {
          script?.addEventListener("load", onScriptReady);
          let attempts = 0;
          const interval = setInterval(async () => {
            attempts++;
            const isReady = await checkOrImportMaps();
            if (isReady) {
              clearInterval(interval);
              if (isMounted) setMapLoaded(true);
            } else if (attempts > 30) {
              clearInterval(interval);
            }
          }, 150);
        }
      });
      return () => {
        isMounted = false;
        script?.removeEventListener("load", onScriptReady);
      };
    }

    script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&callback=__initGoogleMaps`;
    script.async = true;
    script.defer = true;

    script.addEventListener("load", onScriptReady);
    script.onerror = () => {
      if (isMounted) {
        setLoadError("No se pudo conectar con la API de Google Maps. Revisa la conectividad.");
      }
    };

    document.head.appendChild(script);

    return () => {
      isMounted = false;
      script?.removeEventListener("load", onScriptReady);
      delete window.__initGoogleMaps;
    };
  }, [apiKey]);

  // Cerrar sugerencias al hacer clic fuera del buscador
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setMostrarSugerencias(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Inicializar mapa y marcador
  useEffect(() => {
    if (
      !mapLoaded ||
      !mapContainerRef.current ||
      typeof window.google?.maps?.Map !== "function"
    ) {
      return;
    }

    const initialPos = {
      lat: !isNaN(latitud) && latitud !== 0 ? latitud : 19.432608,
      lng: !isNaN(longitud) && longitud !== 0 ? longitud : -99.133209,
    };

    // Crear mapa con mapId para soportar AdvancedMarker y estilos modernos
    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: initialPos,
      zoom: 16,
      mapId: "NOLAN_GEOCERCA_MAP",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: "greedy",
    });

    mapInstanceRef.current = map;

    // Crear marcador (usando AdvancedMarkerElement si está disponible, o Marker tradicional)
    let marker: any = null;
    if (window.google.maps.marker?.AdvancedMarkerElement) {
      try {
        marker = new window.google.maps.marker.AdvancedMarkerElement({
          position: initialPos,
          map,
          title: "Ubicación autorizada para checar",
          gmpDraggable: !disabled,
        });

        if (!disabled) {
          marker.addListener("dragend", () => {
            const pos = marker.position;
            if (pos) {
              const newLat = parseFloat(Number(pos.lat).toFixed(7));
              const newLng = parseFloat(Number(pos.lng).toFixed(7));
              if (circleInstanceRef.current) circleInstanceRef.current.setCenter(pos);
              onLocationChange(newLat, newLng);
            }
          });
        }
      } catch {
        marker = null;
      }
    }

    if (!marker) {
      marker = new window.google.maps.Marker({
        position: initialPos,
        map,
        draggable: !disabled,
        title: "Ubicación autorizada para checar",
        animation: window.google.maps.Animation.DROP,
      });

      if (!disabled) {
        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (pos) {
            const newLat = parseFloat(pos.lat().toFixed(7));
            const newLng = parseFloat(pos.lng().toFixed(7));
            if (circleInstanceRef.current) circleInstanceRef.current.setCenter(pos);
            onLocationChange(newLat, newLng);
          }
        });
      }
    }

    markerInstanceRef.current = marker;

    // Crear círculo de geocerca
    const circle = new window.google.maps.Circle({
      map,
      center: initialPos,
      radius: radioMetros || 150,
      fillColor: "#2563EB",
      fillOpacity: 0.18,
      strokeColor: "#1D4ED8",
      strokeOpacity: 0.85,
      strokeWeight: 2,
    });

    circleInstanceRef.current = circle;

    // Evento al hacer clic en el mapa
    if (!disabled) {
      map.addListener("click", (e: any) => {
        if (e.latLng) {
          const newLat = parseFloat(e.latLng.lat().toFixed(7));
          const newLng = parseFloat(e.latLng.lng().toFixed(7));

          if (marker.setPosition) {
            marker.setPosition(e.latLng);
          } else {
            marker.position = e.latLng;
          }
          circle.setCenter(e.latLng);
          onLocationChange(newLat, newLng);
        }
      });
    }

    return () => {
      if (markerInstanceRef.current) {
        if (markerInstanceRef.current.setMap) markerInstanceRef.current.setMap(null);
        markerInstanceRef.current.map = null;
      }
      if (circleInstanceRef.current) circleInstanceRef.current.setMap(null);
    };
  }, [mapLoaded, disabled, onLocationChange]);

  // Actualizar círculo cuando cambie el radio
  useEffect(() => {
    if (circleInstanceRef.current) {
      circleInstanceRef.current.setRadius(radioMetros || 150);
    }
  }, [radioMetros]);

  // Actualizar posición de mapa y marcador si cambian las coordenadas por props
  useEffect(() => {
    if (!mapInstanceRef.current || !markerInstanceRef.current || isNaN(latitud) || isNaN(longitud)) {
      return;
    }

    const pos = { lat: latitud, lng: longitud };
    if (markerInstanceRef.current.setPosition) {
      markerInstanceRef.current.setPosition(pos);
    } else {
      markerInstanceRef.current.position = pos;
    }

    if (circleInstanceRef.current) circleInstanceRef.current.setCenter(pos);
    mapInstanceRef.current.panTo(pos);
  }, [latitud, longitud]);

  function aplicarLugar(nLat: number, nLng: number, nombreCompleto: string) {
    if (mapInstanceRef.current) {
      const latLng = { lat: nLat, lng: nLng };
      mapInstanceRef.current.panTo(latLng);
      mapInstanceRef.current.setZoom(17);

      if (markerInstanceRef.current) {
        if (markerInstanceRef.current.setPosition) {
          markerInstanceRef.current.setPosition(latLng);
        } else {
          markerInstanceRef.current.position = latLng;
        }
      }

      if (circleInstanceRef.current) {
        circleInstanceRef.current.setCenter(latLng);
      }
    }

    setBusquedaTexto(nombreCompleto);
    setMostrarSugerencias(false);
    onLocationChange(nLat, nLng, nombreCompleto);
  }

  // Buscar lugares directamente en Google Maps
  async function buscarSugerenciasGoogle(texto: string) {
    const q = texto.trim();
    if (!q) {
      setSugerencias([]);
      setMostrarSugerencias(false);
      return;
    }

    // Coordenadas directas: "19.4326, -99.1332"
    const coordsMatch = q.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordsMatch) {
      const cLat = parseFloat(coordsMatch[1]);
      const cLng = parseFloat(coordsMatch[3]);
      if (!isNaN(cLat) && !isNaN(cLng)) {
        aplicarLugar(cLat, cLng, `Coordenadas: ${cLat}, ${cLng}`);
        return;
      }
    }

    setBuscando(true);

    try {
      const res = await buscarLugaresGoogle(q);

      if (!res.placesApiHabilitado) {
        setPlacesApiAviso(true);
        if (res.enlaceActivacion) {
          setEnlaceActivacion(res.enlaceActivacion);
        }
      } else {
        setPlacesApiAviso(false);
      }

      if (res.success && res.sugerencias.length > 0) {
        setSugerencias(res.sugerencias);
        setMostrarSugerencias(true);
      } else {
        setSugerencias([]);
      }
    } catch {
      setSugerencias([]);
    } finally {
      setBuscando(false);
    }
  }

  function handleInputTextoChange(nuevoTexto: string) {
    setBusquedaTexto(nuevoTexto);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (nuevoTexto.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        buscarSugerenciasGoogle(nuevoTexto);
      }, 350);
    } else {
      setSugerencias([]);
      setMostrarSugerencias(false);
    }
  }

  async function seleccionarSugerencia(sug: SugerenciaLugarGoogle) {
    setBuscandoDetalle(true);
    try {
      const res = await obtenerDetalleLugarGoogle(sug.placeId);
      if (res.success && res.lat !== undefined && res.lng !== undefined) {
        aplicarLugar(res.lat, res.lng, res.nombre || sug.nombre);
      } else {
        // Si no se pudo obtener detalle, intentar con el texto directamente
        setBusquedaTexto(sug.nombre);
        setMostrarSugerencias(false);
      }
    } catch {
      setMostrarSugerencias(false);
    } finally {
      setBuscandoDetalle(false);
    }
  }

  function centrarEnGpsActual() {
    if (!navigator.geolocation) return;
    setObteniendoGps(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = parseFloat(pos.coords.latitude.toFixed(7));
        const newLng = parseFloat(pos.coords.longitude.toFixed(7));
        setObteniendoGps(false);
        aplicarLugar(newLat, newLng, `Mi Ubicación GPS (${newLat}, ${newLng})`);
      },
      () => {
        setObteniendoGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Buscador de Lugares Conectado a Google Maps */}
      {!disabled && (
        <div ref={searchContainerRef} className="relative">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={busquedaTexto}
                onChange={(e) => handleInputTextoChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscarSugerenciasGoogle(busquedaTexto);
                  }
                }}
                onFocus={() => {
                  if (sugerencias.length > 0) setMostrarSugerencias(true);
                }}
                placeholder="Buscar en Google Maps (ej. Taller Mecánico Toluca, Av. Insurgentes 400)..."
                className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-9 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 shadow-2xs transition-all"
              />
              {busquedaTexto && (
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaTexto("");
                    setSugerencias([]);
                    setMostrarSugerencias(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => buscarSugerenciasGoogle(busquedaTexto)}
              disabled={buscando || buscandoDetalle || !busquedaTexto.trim()}
              className="rounded-xl text-xs px-3 h-8.5 shrink-0"
            >
              {buscando || buscandoDetalle ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Buscar"
              )}
            </Button>
          </div>

          {/* Menú de sugerencias desplegables directas de Google Maps */}
          {mostrarSugerencias && sugerencias.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white rounded-xl border border-zinc-200 shadow-xl overflow-hidden divide-y divide-zinc-100 max-h-64 overflow-y-auto">
              <div className="bg-zinc-50 px-3 py-1.5 flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                <span className="flex items-center gap-1 text-blue-600 font-semibold">
                  <Sparkles className="h-3 w-3" />
                  Sugerencias de Google Maps
                </span>
                <span>{sugerencias.length} lugares</span>
              </div>
              {sugerencias.map((sug, idx) => (
                <button
                  key={sug.placeId || idx}
                  type="button"
                  onClick={() => seleccionarSugerencia(sug)}
                  disabled={buscandoDetalle}
                  className="w-full text-left p-2.5 text-xs text-zinc-700 hover:bg-blue-50/80 hover:text-blue-950 flex items-start gap-2.5 transition-colors cursor-pointer group disabled:opacity-50"
                >
                  <Building2 className="h-4 w-4 text-zinc-400 group-hover:text-blue-600 mt-0.5 shrink-0 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 group-hover:text-blue-950 truncate">
                      {sug.textoPrincipal}
                    </p>
                    {sug.textoSecundario && (
                      <p className="text-[11px] text-zinc-500 group-hover:text-blue-800/80 truncate">
                        {sug.textoSecundario}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Aviso Proactivo cuando la API Places (New) no está activada en Google Cloud */}
          {placesApiAviso && (
            <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-semibold text-amber-950">
                  Activa "Places API (New)" en Google Cloud para recibir sugerencias
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Tu API Key tiene habilitado el mapa, pero la búsqueda de sugerencias requiere activar <strong>Places API (New)</strong> en tu proyecto de Google Cloud. Es gratuito y se activa con un solo clic:
                </p>
                <div className="pt-1">
                  <a
                    href={enlaceActivacion}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-900 underline text-[11px] bg-white px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs"
                  >
                    Habilitar Places API (New) en Google Cloud Console
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Encabezado y Botón GPS */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-zinc-700 font-semibold">
          <MapPin className="h-4 w-4 text-rose-600" />
          <span>Fijar Punto de Acceso (Busca en Google Maps, haz clic o arrastra el pin)</span>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={centrarEnGpsActual}
            disabled={obteniendoGps}
            className="h-7 px-2.5 text-[11px] rounded-lg"
          >
            {obteniendoGps ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1 text-blue-600" />
            ) : (
              <LocateFixed className="h-3 w-3 mr-1 text-blue-600" />
            )}
            Ubicarme en el mapa
          </Button>
        )}
      </div>

      {/* Contenedor del Mapa */}
      <div className="relative w-full h-[360px] sm:h-[400px] rounded-2xl border border-zinc-300 overflow-hidden shadow-inner bg-zinc-100">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Loading Spinner */}
        {!mapLoaded && !loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100/90 backdrop-blur-xs text-zinc-500 z-10">
            <Loader2 className="h-7 w-7 animate-spin text-zinc-700 mb-2" />
            <span className="text-xs font-medium">Cargando Google Maps...</span>
          </div>
        )}

        {/* Error Fallback */}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50/95 p-6 text-center text-rose-800 z-10">
            <AlertCircle className="h-8 w-8 text-rose-600 mb-2" />
            <span className="text-xs font-semibold">{loadError}</span>
          </div>
        )}

        {/* Indicador flotante del radio */}
        {mapLoaded && (
          <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-xl px-3 py-1.5 shadow-md flex items-center gap-2 text-[11px] text-zinc-700 font-medium">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span>
              Radio de cobertura: <strong>{radioMetros} metros</strong>
            </span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-400">
        💡 El círculo azul transparente representa el área máxima autorizada donde el trabajador podrá checar.
      </p>
    </div>
  );
}
