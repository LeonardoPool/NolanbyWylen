"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  MapPin,
  LocateFixed,
  Globe,
  Radio,
  Server,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Plane,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { notify } from "@/lib/feedback/toast";
import {
  actualizarConfiguracionTaller,
  type ConfiguracionTallerRow,
} from "../actions";
import { GeofenceMapPicker } from "./geofence-map-picker";
import { PermisosViajeLista } from "@/features/permisos-viaje/components/permisos-viaje-lista";
import type { PermisoConEmpleado } from "@/features/permisos-viaje/actions";
import type { EmpleadoRow } from "@/features/empleados/actions";

interface ConfiguracionVistaProps {
  configuracionInicial: ConfiguracionTallerRow;
  empleados?: EmpleadoRow[];
  permisosIniciales?: PermisoConEmpleado[];
  esAdmin: boolean;
}

export function ConfiguracionVista({
  configuracionInicial,
  empleados = [],
  permisosIniciales = [],
  esAdmin,
}: ConfiguracionVistaProps) {
  const [config, setConfig] = useState<ConfiguracionTallerRow>(configuracionInicial);
  const [isPending, startTransition] = useTransition();
  const [obteniendoGps, setObteniendoGps] = useState(false);

  // Form states
  const [nombreTaller, setNombreTaller] = useState(config.nombre_taller);
  const [direccionTaller, setDireccionTaller] = useState(config.direccion_taller);
  const [checadoWebHabilitado, setChecadoWebHabilitado] = useState(config.checado_web_habilitado);
  const [latitud, setLatitud] = useState(String(config.latitud));
  const [longitud, setLongitud] = useState(String(config.longitud));
  const [radioTolerancia, setRadioTolerancia] = useState(String(config.radio_tolerancia_metros));

  function capturarUbicacionActual() {
    if (!navigator.geolocation) {
      notify.error("Geolocalización no soportada", "Tu navegador no admite geolocalización GPS.");
      return;
    }

    setObteniendoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latVal = pos.coords.latitude.toFixed(7);
        const lngVal = pos.coords.longitude.toFixed(7);
        setLatitud(latVal);
        setLongitud(lngVal);
        setObteniendoGps(false);
        notify.success(
          "Coordenadas GPS obtenidas",
          `Lat: ${pos.coords.latitude.toFixed(5)}, Lng: ${pos.coords.longitude.toFixed(5)}`
        );
      },
      (err) => {
        setObteniendoGps(false);
        let mensaje = "No se pudo obtener la posición GPS actual.";
        if (err.code === 1) {
          mensaje = "Permiso de ubicación denegado en el navegador. Habilítalo en los ajustes del sitio.";
        }
        notify.error("Error de GPS", mensaje);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    if (!esAdmin) {
      notify.warning("Solo lectura", "Solo un administrador puede guardar la configuración.");
      return;
    }

    const formData = new FormData();
    formData.append("nombre_taller", nombreTaller);
    formData.append("direccion_taller", direccionTaller);
    formData.append("checado_web_habilitado", checadoWebHabilitado ? "true" : "false");
    formData.append("latitud", latitud);
    formData.append("longitud", longitud);
    formData.append("radio_tolerancia_metros", radioTolerancia);

    startTransition(async () => {
      const res = await actualizarConfiguracionTaller(formData);
      if (!res.success || !res.configuracion) {
        notify.error("Error al guardar", res.error || "No se pudo actualizar.");
        return;
      }
      setConfig(res.configuracion);
      notify.success("Configuración actualizada", res.message || "Cambios guardados con éxito.");
    });
  }

  const numLat = parseFloat(latitud) || 19.432608;
  const numLng = parseFloat(longitud) || -99.133209;
  const numRadio = parseInt(radioTolerancia, 10) || 150;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Configuración del Sistema
          </h1>
          <p className="text-xs text-zinc-500">
            Parámetros operativos de NOLAN, geocerca interactiva de Google Maps y permisos extraordinarios de viaje.
          </p>
        </div>
        <div>
          <Badge variant={esAdmin ? "default" : "outline"} className="text-xs font-mono uppercase">
            {esAdmin ? "Modo Administrador" : "Modo Solo Lectura"}
          </Badge>
        </div>
      </div>

      {/* SECCIÓN 1: CHECADO ONLINE Y MAPA PRINCIPAL CON BUSCADOR */}
      <form onSubmit={handleGuardar} className="space-y-6">
        <Card className="border-blue-200/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-zinc-900">
                  <Globe className="h-4 w-4 text-blue-600" />
                  Punto de Acceso Principal y Geocerca (Google Maps)
                </CardTitle>
                <CardDescription>
                  Define la sede principal del taller donde los trabajadores podrán registrar entrada, descansos y salida desde su celular.
                </CardDescription>
              </div>
              <Badge variant={checadoWebHabilitado ? "success" : "danger"}>
                {checadoWebHabilitado ? "Habilitado" : "Deshabilitado"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-5">
            {/* Switch General */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/90 bg-[#FAF9F6]">
              <div>
                <span className="text-xs font-bold text-zinc-900 block">
                  Activar Portal de Checado Online (/checador)
                </span>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                  Si se desactiva, los trabajadores solo podrán registrar asistencia usando el checador físico ZKTeco MB10V.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={checadoWebHabilitado}
                  disabled={!esAdmin || isPending}
                  onChange={(e) => setChecadoWebHabilitado(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900"></div>
              </label>
            </div>

            {/* Componente Interactivo de Google Maps con Buscador Places y Geocerca */}
            <div className="space-y-3 pt-2">
              <GeofenceMapPicker
                latitud={numLat}
                longitud={numLng}
                radioMetros={numRadio}
                disabled={!esAdmin || isPending}
                onLocationChange={(newLat, newLng, direccionSugerida) => {
                  setLatitud(newLat.toFixed(7));
                  setLongitud(newLng.toFixed(7));
                  if (direccionSugerida && (!direccionTaller || direccionTaller === "Taller Mecánico Principal")) {
                    setDireccionTaller(direccionSugerida);
                  }
                }}
              />

              {/* Controles de Coordenadas y Radio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-600">Latitud GPS</label>
                  <input
                    type="text"
                    required
                    value={latitud}
                    onChange={(e) => setLatitud(e.target.value)}
                    disabled={!esAdmin || isPending}
                    placeholder="Ej. 19.432608"
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs font-mono text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-600">Longitud GPS</label>
                  <input
                    type="text"
                    required
                    value={longitud}
                    onChange={(e) => setLongitud(e.target.value)}
                    disabled={!esAdmin || isPending}
                    placeholder="Ej. -99.133209"
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs font-mono text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-zinc-600">
                      Radio de Tolerancia ({numRadio} m)
                    </label>
                    <span className="text-[10px] text-zinc-400 font-mono">10m - 2000m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={20}
                      max={1000}
                      step={10}
                      value={numRadio}
                      onChange={(e) => setRadioTolerancia(e.target.value)}
                      disabled={!esAdmin || isPending}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      required
                      value={radioTolerancia}
                      onChange={(e) => setRadioTolerancia(e.target.value)}
                      disabled={!esAdmin || isPending}
                      className="w-20 rounded-xl border border-zinc-200 bg-[#F9F9FB] px-2 py-1.5 text-xs font-mono text-zinc-900 text-center focus:bg-white focus:border-zinc-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Nombre y Dirección */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-600">Nombre del Taller / Sede</label>
                  <input
                    type="text"
                    required
                    value={nombreTaller}
                    onChange={(e) => setNombreTaller(e.target.value)}
                    disabled={!esAdmin || isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-600">Dirección o Referencia</label>
                  <input
                    type="text"
                    value={direccionTaller}
                    onChange={(e) => setDireccionTaller(e.target.value)}
                    disabled={!esAdmin || isPending}
                    placeholder="Ej. Av. Principal, Colonia Centro"
                    className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {esAdmin && (
              <div className="pt-2 flex justify-end">
                <Button type="submit" size="sm" disabled={isPending} className="rounded-xl shadow-xs text-xs">
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Guardando Parámetros...
                    </>
                  ) : (
                    "Guardar Punto de Acceso Principal"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>

      {/* SECCIÓN 2: PERMISOS EXTRAORDINARIOS DE VIAJE (VIGENCIA TEMPORAL) */}
      <Card className="border-zinc-200/90 shadow-xs">
        <CardContent className="pt-6">
          <PermisosViajeLista
            permisosIniciales={permisosIniciales}
            empleados={empleados}
            esAdmin={esAdmin}
          />
        </CardContent>
      </Card>

      {/* SECCIÓN 3: HARDWARE Y BASE DE DATOS */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-zinc-700" strokeWidth={1.5} />
                  Checador Biométrico Físico
                </CardTitle>
                <CardDescription>
                  Dispositivo físico asignado en Servicio Mecánico López.
                </CardDescription>
              </div>
              <Badge variant="warning">En espera</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-zinc-200/70 bg-[#FAF9F6] p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Modelo previsto:</span>
                <span className="font-medium text-zinc-900">ZKTeco MB10V</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Autenticación de tramas:</span>
                <span className="text-zinc-800 font-mono text-[11px]">Token SHA-256</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Biometría en la nube:</span>
                <span className="text-zinc-700">Desactivada (100% local en hardware)</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
              <AlertCircle className="h-4 w-4 shrink-0 text-zinc-400 mt-0.5" strokeWidth={1.5} />
              <p className="text-[11px] leading-relaxed">
                El token precompartido para el dispositivo se encuentra configurado en <code className="text-zinc-800 bg-zinc-100 px-1 py-0.5 rounded font-mono">CHECADOR_DEVICE_TOKEN</code> en el servidor.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-zinc-700" strokeWidth={1.5} />
              Base de Datos y Seguridad Cloud
            </CardTitle>
            <CardDescription>
              Plataforma en la nube y almacenamiento relacional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-zinc-200/70 bg-[#FAF9F6] p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Motor relacional:</span>
                <span className="font-medium text-zinc-900">PostgreSQL (Supabase)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Políticas de seguridad:</span>
                <span className="text-emerald-700 font-medium">Row Level Security (RLS) v2.2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Permisos extraordinarios:</span>
                <span className="text-blue-700 font-medium">Vigencia temporal 1-14 días</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200/80 bg-white text-xs">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
                <span className="text-zinc-700 font-medium text-[11px]">Tablas e Índices v2.2</span>
              </div>
              <Badge variant="success">Desplegado</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
