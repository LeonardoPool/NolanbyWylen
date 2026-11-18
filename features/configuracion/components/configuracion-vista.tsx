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
  Clock,
  Calendar,
  Sparkles,
  Users,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { notify } from "@/lib/feedback/toast";
import {
  actualizarConfiguracionTaller,
  actualizarHorarioLaboralConfig,
  type ConfiguracionTallerRow,
} from "../actions";
import {
  type HorarioLaboralConfig,
  HORARIO_LABORAL_DEFAULT,
  obtenerDiasSegundoHorario,
  formatearResumenDias,
  convertirHoraAMinutos,
} from "@/lib/lft/calculo-horas";
import { GeofenceMapPicker } from "./geofence-map-picker";
import { PermisosViajeLista } from "@/features/permisos-viaje/components/permisos-viaje-lista";
import type { PermisoConEmpleado } from "@/features/permisos-viaje/actions";
import type { EmpleadoRow } from "@/features/empleados/actions";

interface ConfiguracionVistaProps {
  configuracionInicial: ConfiguracionTallerRow;
  empleados?: EmpleadoRow[];
  permisosIniciales?: PermisoConEmpleado[];
  horarioInicial?: HorarioLaboralConfig;
  esAdmin: boolean;
}

export function ConfiguracionVista({
  configuracionInicial,
  empleados = [],
  permisosIniciales = [],
  horarioInicial,
  esAdmin,
}: ConfiguracionVistaProps) {
  const [config, setConfig] = useState<ConfiguracionTallerRow>(configuracionInicial);
  const [isPending, startTransition] = useTransition();
  const [isPendingHorario, startTransitionHorario] = useTransition();
  const [obteniendoGps, setObteniendoGps] = useState(false);

  // Form states - Geocerca y Taller
  const [nombreTaller, setNombreTaller] = useState(config.nombre_taller);
  const [direccionTaller, setDireccionTaller] = useState(config.direccion_taller);
  const [checadoWebHabilitado, setChecadoWebHabilitado] = useState(config.checado_web_habilitado);
  const [latitud, setLatitud] = useState(String(config.latitud));
  const [longitud, setLongitud] = useState(String(config.longitud));
  const [radioTolerancia, setRadioTolerancia] = useState(String(config.radio_tolerancia_metros));

  // Form states - Sistema Inteligente de Horario Laboral y Horas Extras
  const horarioBase = horarioInicial || HORARIO_LABORAL_DEFAULT;
  const [diasSemanal, setDiasSemanal] = useState<number[]>(
    Array.isArray(horarioBase.semanal.dias) ? horarioBase.semanal.dias : [1, 2, 3, 4, 5]
  );
  const [horaEntradaSemanal, setHoraEntradaSemanal] = useState(horarioBase.semanal.horaEntrada);
  const [horaSalidaSemanal, setHoraSalidaSemanal] = useState(horarioBase.semanal.horaSalida);
  const [toleranciaSemanal, setToleranciaSemanal] = useState(String(horarioBase.semanal.toleranciaEntradaMinutos));

  const [sabadoLaborable, setSabadoLaborable] = useState(horarioBase.finDeSemana.sabadoLaborable);
  const [diasFinDeSemana, setDiasFinDeSemana] = useState<number[]>(
    obtenerDiasSegundoHorario(horarioBase)
  );
  const [horaEntradaSabado, setHoraEntradaSabado] = useState(horarioBase.finDeSemana.horaEntradaSabado);
  const [horaSalidaSabado, setHoraSalidaSabado] = useState(horarioBase.finDeSemana.horaSalidaSabado);
  const [toleranciaSabado, setToleranciaSabado] = useState(String(horarioBase.finDeSemana.toleranciaSabadoMinutos));

  const [umbralExtras, setUmbralExtras] = useState(String(horarioBase.horasExtras.minutosMinimosToleranciaSalida));

  // Días de la semana ordenados de Lunes (1) a Domingo (0)
  const CATALOGO_DIAS = [
    { id: 1, corto: "Lun", letra: "L", nombre: "Lunes" },
    { id: 2, corto: "Mar", letra: "M", nombre: "Martes" },
    { id: 3, corto: "Mié", letra: "X", nombre: "Miércoles" },
    { id: 4, corto: "Jue", letra: "J", nombre: "Jueves" },
    { id: 5, corto: "Vie", letra: "V", nombre: "Viernes" },
    { id: 6, corto: "Sáb", letra: "S", nombre: "Sábado" },
    { id: 0, corto: "Dom", letra: "D", nombre: "Domingo" },
  ];

  // Días de descanso calculados automáticamente por exclusión mutua inteligente
  const diasDescansoCalculados = React.useMemo(() => {
    const activosSegundo = sabadoLaborable ? diasFinDeSemana : [];
    const ocupados = new Set([...diasSemanal, ...activosSegundo]);
    return [1, 2, 3, 4, 5, 6, 0].filter((d) => !ocupados.has(d));
  }, [diasSemanal, diasFinDeSemana, sabadoLaborable]);

  // Alternar un día en el Horario Principal / Semanal (con resolución automática de conflictos)
  function toggleDiaSemanal(diaId: number) {
    if (!esAdmin || isPendingHorario) return;
    if (diasSemanal.includes(diaId)) {
      setDiasSemanal((prev) => prev.filter((d) => d !== diaId));
    } else {
      setDiasSemanal((prev) => [...prev, diaId]);
      // Remover automáticamente del segundo horario si estaba ahí
      setDiasFinDeSemana((prev) => {
        const nuevos = prev.filter((d) => d !== diaId);
        if (nuevos.length === 0) setSabadoLaborable(false);
        return nuevos;
      });
    }
  }

  // Alternar un día en el Horario Secundario / Fin de Semana (con resolución automática de conflictos)
  function toggleDiaFinDeSemana(diaId: number) {
    if (!esAdmin || isPendingHorario) return;
    if (diasFinDeSemana.includes(diaId) && sabadoLaborable) {
      const nuevos = diasFinDeSemana.filter((d) => d !== diaId);
      setDiasFinDeSemana(nuevos);
      if (nuevos.length === 0) setSabadoLaborable(false);
    } else {
      setSabadoLaborable(true);
      setDiasFinDeSemana((prev) => (prev.includes(diaId) ? prev : [...prev, diaId]));
      // Remover automáticamente del horario principal si estaba ahí
      setDiasSemanal((prev) => prev.filter((d) => d !== diaId));
    }
  }

  // Ciclar estado de un día al hacer clic en el Mapa Inteligente de 7 Días (Principal -> Fin de Semana -> Descanso)
  function ciclarEstadoDiaMatriz(diaId: number) {
    if (!esAdmin || isPendingHorario) return;
    const enSemanal = diasSemanal.includes(diaId);
    const enEspecial = sabadoLaborable && diasFinDeSemana.includes(diaId);

    if (enSemanal) {
      // Pasar de Semanal a Fin de Semana / Especial
      setDiasSemanal((prev) => prev.filter((d) => d !== diaId));
      setSabadoLaborable(true);
      setDiasFinDeSemana((prev) => (prev.includes(diaId) ? prev : [...prev, diaId]));
    } else if (enEspecial) {
      // Pasar de Fin de Semana a Descanso
      const nuevos = diasFinDeSemana.filter((d) => d !== diaId);
      setDiasFinDeSemana(nuevos);
      if (nuevos.length === 0) setSabadoLaborable(false);
    } else {
      // Pasar de Descanso a Semanal
      setDiasSemanal((prev) => [...prev, diaId]);
    }
  }

  // Aplicar plantillas preconfiguradas inteligentes con 1 clic
  function aplicarPlantillaInteligente(tipo: "taller" | "inglesa" | "continua" | "guardia") {
    if (!esAdmin || isPendingHorario) return;
    if (tipo === "taller") {
      setDiasSemanal([1, 2, 3, 4, 5]);
      setHoraEntradaSemanal("08:00");
      setHoraSalidaSemanal("18:00");
      setToleranciaSemanal("15");
      setSabadoLaborable(true);
      setDiasFinDeSemana([6]);
      setHoraEntradaSabado("09:00");
      setHoraSalidaSabado("14:00");
      setToleranciaSabado("15");
      notify.info("Plantilla aplicada", "Estándar Taller: Lun-Vie (08:00-18:00) + Sáb (09:00-14:00) + Dom Descanso.");
    } else if (tipo === "inglesa") {
      setDiasSemanal([1, 2, 3, 4, 5]);
      setHoraEntradaSemanal("08:00");
      setHoraSalidaSemanal("18:00");
      setToleranciaSemanal("15");
      setSabadoLaborable(false);
      setDiasFinDeSemana([]);
      notify.info("Plantilla aplicada", "Semana Inglesa: Lun-Vie (08:00-18:00) + Sáb y Dom Descanso.");
    } else if (tipo === "continua") {
      setDiasSemanal([1, 2, 3, 4, 5, 6]);
      setHoraEntradaSemanal("08:00");
      setHoraSalidaSemanal("16:00");
      setToleranciaSemanal("15");
      setSabadoLaborable(false);
      setDiasFinDeSemana([]);
      notify.info("Plantilla aplicada", "Jornada Continua 6 Días: Lun-Sáb (08:00-16:00) + Dom Descanso.");
    } else if (tipo === "guardia") {
      setDiasSemanal([2, 3, 4, 5]);
      setHoraEntradaSemanal("08:00");
      setHoraSalidaSemanal("18:00");
      setSabadoLaborable(true);
      setDiasFinDeSemana([6, 0]);
      setHoraEntradaSabado("09:00");
      setHoraSalidaSabado("15:00");
      notify.info("Plantilla aplicada", "Guardia Fin de Semana: Mar-Vie + Sáb y Dom activos + Lun Descanso.");
    }
  }

  // Cálculo inteligente de horas semanales programadas y ejemplos dinámicos de horas extras
  const resumenInteligente = React.useMemo(() => {
    const minSem = Math.max(
      0,
      convertirHoraAMinutos(horaSalidaSemanal) - convertirHoraAMinutos(horaEntradaSemanal)
    );
    const minEsp = sabadoLaborable
      ? Math.max(0, convertirHoraAMinutos(horaSalidaSabado) - convertirHoraAMinutos(horaEntradaSabado))
      : 0;
    const cantEsp = sabadoLaborable ? diasFinDeSemana.length : 0;
    const totalMinSemana = diasSemanal.length * minSem + cantEsp * minEsp;
    const horasSemana = (totalMinSemana / 60).toFixed(1).replace(/\.0$/, "");

    const formatMinToHora = (totalM: number) => {
      const norm = ((totalM % 1440) + 1440) % 1440;
      const h = Math.floor(norm / 60);
      const m = norm % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const baseSalidaMin = convertirHoraAMinutos(horaSalidaSemanal);
    const umbralNum = Math.max(1, parseInt(umbralExtras, 10) || 15);

    return {
      horasSemana,
      horasPorDiaSemanal: (minSem / 60).toFixed(1).replace(/\.0$/, ""),
      horasPorDiaEspecial: (minEsp / 60).toFixed(1).replace(/\.0$/, ""),
      totalDiasLaborables: diasSemanal.length + cantEsp,
      ejemploNoCalificaHora: formatMinToHora(baseSalidaMin + umbralNum - 1),
      ejemploCalificaMinimoHora: formatMinToHora(baseSalidaMin + umbralNum),
      ejemploCalifica90mHora: formatMinToHora(baseSalidaMin + 90),
      umbralNum,
    };
  }, [
    horaEntradaSemanal,
    horaSalidaSemanal,
    sabadoLaborable,
    horaEntradaSabado,
    horaSalidaSabado,
    diasSemanal.length,
    diasFinDeSemana.length,
    umbralExtras,
  ]);

  function handleGuardarHorario(e: React.FormEvent) {
    e.preventDefault();
    if (!esAdmin) {
      notify.warning("Solo lectura", "Solo un administrador puede modificar el horario laboral.");
      return;
    }

    const diasActivosSegundo = sabadoLaborable ? diasFinDeSemana : [];
    if (diasSemanal.length === 0 && diasActivosSegundo.length === 0) {
      notify.error("Sin días laborables", "Debes seleccionar al menos un día laborable en la semana.");
      return;
    }

    const descansoPrincipal =
      diasDescansoCalculados.includes(0)
        ? 0
        : diasDescansoCalculados[0] !== undefined
        ? diasDescansoCalculados[0]
        : 0;

    const payload: HorarioLaboralConfig = {
      semanal: {
        dias: diasSemanal,
        horaEntrada: horaEntradaSemanal,
        horaSalida: horaSalidaSemanal,
        toleranciaEntradaMinutos: parseInt(toleranciaSemanal, 10) || 15,
      },
      finDeSemana: {
        sabadoLaborable: diasActivosSegundo.length > 0,
        dias: diasActivosSegundo,
        horaEntradaSabado,
        horaSalidaSabado,
        toleranciaSabadoMinutos: parseInt(toleranciaSabado, 10) || 15,
        diaDescansoSemanal: descansoPrincipal,
        diasDescanso: diasDescansoCalculados,
      },
      horasExtras: {
        minutosMinimosToleranciaSalida: parseInt(umbralExtras, 10) || 15,
      },
    };

    startTransitionHorario(async () => {
      const res = await actualizarHorarioLaboralConfig(payload);
      if (!res.success) {
        notify.error("Error al guardar horario", res.error || "No se pudo actualizar el horario.");
        return;
      }
      notify.success("Horario laboral actualizado", res.message || "Aplica a todos los empleados.");
    });
  }

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

      {/* SECCIÓN SISTEMA INTELIGENTE DE HORARIO LABORAL Y HORAS EXTRAS (LFT) */}
      <form onSubmit={handleGuardarHorario} className="space-y-6">
        <Card className="border-amber-200/90 shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-zinc-100 bg-gradient-to-r from-amber-50/40 via-white to-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-zinc-900">
                  <Clock className="h-4 w-4 text-amber-600" />
                  Sistema Inteligente de Horario Laboral & Horas Extras (LFT)
                </CardTitle>
                <CardDescription>
                  Asigna dinámicamente qué días aplican al horario principal, cuáles al horario de fin de semana/especial y cuáles son de descanso. Se sincroniza en vivo con Dashboard, Analítica y Reportes.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 flex items-center gap-1 text-[11px]">
                  <Users className="h-3 w-3" />
                  Universal (Todos los Empleados)
                </Badge>
                <Badge variant="outline" className="bg-zinc-900 text-white border-zinc-800 text-[11px] font-mono">
                  {resumenInteligente.horasSemana} h / sem
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-6">
            {/* 1. Plantillas Inteligentes de 1 Clic */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-700 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  Plantillas Inteligentes de Jornada (1 Clic)
                </span>
                <span className="text-[10px] text-zinc-400">
                  O personaliza libremente cada día abajo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={!esAdmin || isPendingHorario}
                  onClick={() => aplicarPlantillaInteligente("taller")}
                  className="text-left p-2.5 rounded-xl border border-zinc-200 bg-white hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer group"
                >
                  <span className="text-[11px] font-bold text-zinc-900 group-hover:text-amber-800 block">
                    Estándar Taller (5.5 Días)
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">
                    L-V 08:00–18:00 • Sáb 09:00–14:00
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!esAdmin || isPendingHorario}
                  onClick={() => aplicarPlantillaInteligente("inglesa")}
                  className="text-left p-2.5 rounded-xl border border-zinc-200 bg-white hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer group"
                >
                  <span className="text-[11px] font-bold text-zinc-900 group-hover:text-amber-800 block">
                    Semana Inglesa (5 Días)
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">
                    L-V 08:00–18:00 • Sáb y Dom Descanso
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!esAdmin || isPendingHorario}
                  onClick={() => aplicarPlantillaInteligente("continua")}
                  className="text-left p-2.5 rounded-xl border border-zinc-200 bg-white hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer group"
                >
                  <span className="text-[11px] font-bold text-zinc-900 group-hover:text-amber-800 block">
                    Jornada Continua (6 Días)
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">
                    L-S 08:00–16:00 • Dom Descanso
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!esAdmin || isPendingHorario}
                  onClick={() => aplicarPlantillaInteligente("guardia")}
                  className="text-left p-2.5 rounded-xl border border-zinc-200 bg-white hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer group"
                >
                  <span className="text-[11px] font-bold text-zinc-900 group-hover:text-amber-800 block">
                    Guardia Fin de Semana
                  </span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">
                    Mar-Vie + Sáb/Dom • Lun Descanso
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Mapa Semanal Interactivo de 7 Días */}
            <div className="rounded-2xl border border-zinc-200/90 bg-white p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-zinc-700" />
                  Mapa Interactivo de la Semana (Haz clic en cualquier día para alternar su régimen)
                </span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1 font-medium text-zinc-700">
                    <span className="h-2 w-2 rounded-full bg-zinc-900" /> Horario Principal
                  </span>
                  <span className="flex items-center gap-1 font-medium text-amber-800">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> 2º Horario / Fin Sem.
                  </span>
                  <span className="flex items-center gap-1 font-medium text-emerald-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Descanso LFT
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                {CATALOGO_DIAS.map((dia) => {
                  const esSemanal = diasSemanal.includes(dia.id);
                  const esEspecial = sabadoLaborable && diasFinDeSemana.includes(dia.id);

                  return (
                    <button
                      key={`matriz-${dia.id}`}
                      type="button"
                      disabled={!esAdmin || isPendingHorario}
                      onClick={() => ciclarEstadoDiaMatriz(dia.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[76px] ${
                        esSemanal
                          ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                          : esEspecial
                          ? "bg-amber-50/90 text-amber-950 border-amber-300 shadow-2xs"
                          : "bg-emerald-50/60 text-emerald-950 border-emerald-200/80"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold">{dia.corto}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            esSemanal
                              ? "bg-zinc-700 text-zinc-100"
                              : esEspecial
                              ? "bg-amber-200/80 text-amber-900"
                              : "bg-emerald-200/70 text-emerald-900"
                          }`}
                        >
                          {esSemanal ? "Principal" : esEspecial ? "Especial" : "Descanso"}
                        </span>
                      </div>

                      <div className="mt-2">
                        {esSemanal ? (
                          <span className="text-[10px] font-mono text-zinc-200 block">
                            {horaEntradaSemanal} – {horaSalidaSemanal}
                          </span>
                        ) : esEspecial ? (
                          <span className="text-[10px] font-mono text-amber-800 font-semibold block">
                            {horaEntradaSabado} – {horaSalidaSabado}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-medium block">
                            Inhábil LFT
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Configuración Detallada de los 2 Bloques de Horario */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bloque 1: Horario Principal / Semanal */}
              <div className="rounded-2xl border border-zinc-200/80 bg-[#FAF9F6] p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
                  <div className="flex items-center gap-2">
                    <div className="h-7 px-2 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-[11px] font-bold">
                      {formatearResumenDias(diasSemanal)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900">Horario Principal (Semanal)</h4>
                      <p className="text-[10px] text-zinc-500">
                        {resumenInteligente.horasPorDiaSemanal} h por día seleccionado
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="text-[10px] bg-zinc-800">
                    {diasSemanal.length} {diasSemanal.length === 1 ? "día" : "días"}
                  </Badge>
                </div>

                {/* Selector interactivo de días para el Horario Principal */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-700 block">
                    Días en que aplica este horario:
                  </label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {CATALOGO_DIAS.map((d) => {
                      const activo = diasSemanal.includes(d.id);
                      return (
                        <button
                          key={`sem-btn-${d.id}`}
                          type="button"
                          disabled={!esAdmin || isPendingHorario}
                          onClick={() => toggleDiaSemanal(d.id)}
                          title={`${d.nombre}: ${activo ? "Quitar del horario principal" : "Asignar al horario principal"}`}
                          className={`min-h-[38px] rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center border ${
                            activo
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                              : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <span>{d.corto}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-700">Hora de Entrada</label>
                    <input
                      type="time"
                      required
                      value={horaEntradaSemanal}
                      onChange={(e) => setHoraEntradaSemanal(e.target.value)}
                      disabled={!esAdmin || isPendingHorario}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-mono font-medium text-zinc-900 focus:border-zinc-900 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-700">Hora de Salida</label>
                    <input
                      type="time"
                      required
                      value={horaSalidaSemanal}
                      onChange={(e) => setHoraSalidaSemanal(e.target.value)}
                      disabled={!esAdmin || isPendingHorario}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-mono font-medium text-zinc-900 focus:border-zinc-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-zinc-700">Tolerancia de Entrada</span>
                    <span className="text-zinc-500 font-mono text-[10px]">{toleranciaSemanal} minutos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={5}
                      value={toleranciaSemanal}
                      onChange={(e) => setToleranciaSemanal(e.target.value)}
                      disabled={!esAdmin || isPendingHorario}
                      className="w-full accent-zinc-900 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-zinc-700 w-12 text-right">{toleranciaSemanal}m</span>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    A partir del minuto {Number(toleranciaSemanal) + 1} se computa retardo en analítica y reportes.
                  </p>
                </div>
              </div>

              {/* Bloque 2: Segundo Horario / Fin de Semana y Días de Descanso */}
              <div className="rounded-2xl border border-zinc-200/80 bg-[#FAF9F6] p-4 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
                    <div className="flex items-center gap-2">
                      <div className="h-7 px-2 rounded-lg bg-amber-600 text-white flex items-center justify-center text-[11px] font-bold">
                        {sabadoLaborable && diasFinDeSemana.length > 0
                          ? formatearResumenDias(diasFinDeSemana)
                          : "Inactivo"}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-900">
                          2º Horario / Fin de Semana
                        </h4>
                        <p className="text-[10px] text-zinc-500">
                          {sabadoLaborable && diasFinDeSemana.length > 0
                            ? `${resumenInteligente.horasPorDiaEspecial} h por día especial`
                            : "Sin segundo turno activo"}
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center gap-2 cursor-pointer">
                      <span className="text-[11px] font-medium text-zinc-700">
                        {sabadoLaborable ? "Habilitado" : "Deshabilitado"}
                      </span>
                      <input
                        type="checkbox"
                        checked={sabadoLaborable}
                        disabled={!esAdmin || isPendingHorario}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSabadoLaborable(checked);
                          if (checked && diasFinDeSemana.length === 0) {
                            // Sugerir inteligentemente Sábado (6) o el primer día libre
                            const candidato = !diasSemanal.includes(6) ? 6 : 0;
                            setDiasFinDeSemana([candidato]);
                            setDiasSemanal((prev) => prev.filter((d) => d !== candidato));
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] peer-checked:after:right-auto after:left-[calc(100%-34px)] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {/* Selector interactivo de días para el Segundo Horario */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-zinc-700 block">
                      Días en que aplica este 2º horario (ej. Sábado medio turno):
                    </label>
                    <div className="grid grid-cols-7 gap-1.5">
                      {CATALOGO_DIAS.map((d) => {
                        const activo = sabadoLaborable && diasFinDeSemana.includes(d.id);
                        return (
                          <button
                            key={`esp-btn-${d.id}`}
                            type="button"
                            disabled={!esAdmin || isPendingHorario}
                            onClick={() => toggleDiaFinDeSemana(d.id)}
                            title={`${d.nombre}: ${activo ? "Quitar del 2º horario" : "Asignar al 2º horario"}`}
                            className={`min-h-[38px] rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center border ${
                              activo
                                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                : "bg-white text-zinc-500 border-zinc-200 hover:border-amber-400"
                            }`}
                          >
                            <span>{d.corto}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {sabadoLaborable && diasFinDeSemana.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-zinc-700">Hora de Entrada</label>
                          <input
                            type="time"
                            required
                            value={horaEntradaSabado}
                            onChange={(e) => setHoraEntradaSabado(e.target.value)}
                            disabled={!esAdmin || isPendingHorario}
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-mono font-medium text-zinc-900 focus:border-zinc-900 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-zinc-700">Hora de Salida</label>
                          <input
                            type="time"
                            required
                            value={horaSalidaSabado}
                            onChange={(e) => setHoraSalidaSabado(e.target.value)}
                            disabled={!esAdmin || isPendingHorario}
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-mono font-medium text-zinc-900 focus:border-zinc-900 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-zinc-700">Tolerancia de Entrada</span>
                          <span className="text-zinc-500 font-mono text-[10px]">{toleranciaSabado} minutos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={60}
                            step={5}
                            value={toleranciaSabado}
                            onChange={(e) => setToleranciaSabado(e.target.value)}
                            disabled={!esAdmin || isPendingHorario}
                            className="w-full accent-amber-600 cursor-pointer"
                          />
                          <span className="text-xs font-mono text-zinc-700 w-12 text-right">{toleranciaSabado}m</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 bg-zinc-100/80 rounded-xl text-center text-zinc-500 text-xs">
                      Segundo horario desactivado. Todos los días fuera del horario principal se consideran días de descanso.
                    </div>
                  )}
                </div>

                {/* Resumen Automático de Días de Descanso LFT */}
                <div className="pt-3 border-t border-zinc-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-600 font-medium">
                    Días de descanso detectados ({diasDescansoCalculados.length}):
                  </span>
                  {diasDescansoCalculados.length > 0 ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold">
                      {formatearResumenDias(diasDescansoCalculados)} (Art. 69 LFT)
                    </Badge>
                  ) : (
                    <Badge variant="danger" className="text-[10px]">
                      Sin descanso asignado (Revisa Art. 69 LFT)
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Bloque de Política de Horas Extras con Simulador Dinámico */}
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Timer className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-zinc-900">
                      Política Inteligente de Horas Extras (Umbral de Activación)
                    </h4>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                      Del horario final laboral, el empleado genera tiempo extra <strong>solo y siempre que marque su salida al menos {resumenInteligente.umbralNum} minutos después de la hora de salida programada</strong>. Al alcanzar ese umbral, el tiempo extra corre en minutos y horas desde la hora oficial de salida.
                    </p>
                  </div>
                </div>

                {/* Control del umbral de activación */}
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-blue-200 shrink-0 self-start">
                  <label className="text-[11px] font-semibold text-zinc-700 whitespace-nowrap">
                    Umbral mínimo:
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={60}
                    step={5}
                    value={umbralExtras}
                    onChange={(e) => setUmbralExtras(e.target.value)}
                    disabled={!esAdmin || isPendingHorario}
                    className="w-14 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-mono font-bold text-blue-700 text-center focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                  <span className="text-[11px] font-mono text-zinc-500">min</span>
                </div>
              </div>

              {/* Simulador dinámico en vivo según la Hora de Salida configurada */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="bg-white/90 p-2.5 rounded-xl border border-blue-100">
                  <span className="text-zinc-500 block text-[10px]">
                    Salida a las {resumenInteligente.ejemploNoCalificaHora}
                  </span>
                  <span className="font-semibold text-zinc-700">0 min extras</span>
                  <p className="text-[9px] text-zinc-400 mt-0.5">
                    Menor a {resumenInteligente.umbralNum} min tras las {horaSalidaSemanal}: sin tiempo extra.
                  </p>
                </div>

                <div className="bg-white/90 p-2.5 rounded-xl border border-blue-100">
                  <span className="text-zinc-500 block text-[10px]">
                    Salida a las {resumenInteligente.ejemploCalificaMinimoHora}
                  </span>
                  <span className="font-semibold text-emerald-600">
                    {resumenInteligente.umbralNum} min extras
                  </span>
                  <p className="text-[9px] text-zinc-400 mt-0.5">
                    Alcanza umbral: computa íntegro desde las {horaSalidaSemanal}.
                  </p>
                </div>

                <div className="bg-white/90 p-2.5 rounded-xl border border-blue-100">
                  <span className="text-zinc-500 block text-[10px]">
                    Salida a las {resumenInteligente.ejemploCalifica90mHora}
                  </span>
                  <span className="font-semibold text-emerald-600">1 h 30 min extras</span>
                  <p className="text-[9px] text-zinc-400 mt-0.5">
                    Computa 90 minutos de tiempo extraordinario.
                  </p>
                </div>
              </div>
            </div>

            {esAdmin && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                <span className="text-[11px] text-zinc-500">
                  Resumen: <strong>{resumenInteligente.totalDiasLaborables} días laborables</strong> ({resumenInteligente.horasSemana} h/sem) y <strong>{diasDescansoCalculados.length} de descanso</strong>.
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPendingHorario}
                  className="rounded-xl shadow-xs text-xs bg-zinc-900 hover:bg-zinc-800 text-white cursor-pointer"
                >
                  {isPendingHorario ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Sincronizando Horario Inteligente...
                    </>
                  ) : (
                    "Guardar Horario Laboral y Sincronizar Analítica"
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
