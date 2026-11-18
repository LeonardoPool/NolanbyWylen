"use client";

import * as React from "react";
import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldCheck,
  Smartphone,
  Eye,
  Camera,
  Layers,
  List as ListIcon,
  Sparkles,
  Loader2,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  X,
  ExternalLink,
  Navigation,
  Compass,
  Maximize2,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { notify } from "@/lib/feedback/toast";
import { createClient } from "@/lib/supabase/client";
import { GoogleMapMarcajes } from "./google-map-marcajes";
import {
  HORARIO_LABORAL_DEFAULT,
  formatearResumenDias,
  obtenerDiasSegundoHorario,
  obtenerDiasDescanso,
  evaluarConfiguracionPorDiaSemana,
} from "@/lib/lft/calculo-horas";
import {
  obtenerDatosRegistroJornadaDashboard,
  type DatosRegistroJornadaDashboard,
  type DiaCalendarioInfo,
  type EventoMarcajeDetalle,
} from "../actions";

interface DashboardJornadaVistaProps {
  datosIniciales: DatosRegistroJornadaDashboard;
}

type ModoVistaCalendario = "mes" | "semana" | "quincena" | "lista";

const HORAS_CALENDARIO = [
  { hora: 6, label: "6 AM" },
  { hora: 7, label: "7 AM" },
  { hora: 8, label: "8 AM" },
  { hora: 9, label: "9 AM" },
  { hora: 10, label: "10 AM" },
  { hora: 11, label: "11 AM" },
  { hora: 12, label: "12 PM" },
  { hora: 13, label: "1 PM" },
  { hora: 14, label: "2 PM" },
  { hora: 15, label: "3 PM" },
  { hora: 16, label: "4 PM" },
  { hora: 17, label: "5 PM" },
  { hora: 18, label: "6 PM" },
  { hora: 19, label: "7 PM" },
  { hora: 20, label: "8 PM" },
];

function parseHoraAMinutos(horaStr?: string): number | null {
  if (!horaStr) return null;
  const match = horaStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (horaStr.toUpperCase().includes("PM") && h < 12) h += 12;
  if (horaStr.toUpperCase().includes("AM") && h === 12) h = 0;
  return h * 60 + m;
}

export function DashboardJornadaVista({ datosIniciales }: DashboardJornadaVistaProps) {
  const [datos, setDatos] = useState<DatosRegistroJornadaDashboard>(datosIniciales);
  const [empleadoSeleccionadoId, setEmpleadoSeleccionadoId] = useState(
    datosIniciales.empleadoSeleccionado.id
  );
  const [mesActual, setMesActual] = useState(datosIniciales.resumenMes.mesNumero);
  const [anioActual, setAnioActual] = useState(datosIniciales.resumenMes.anio);

  // Modo de vista estilo Google Calendar (Mes, Semana, Quincena, Lista)
  const [modoVista, setModoVista] = useState<ModoVistaCalendario>("mes");

  // Sub-índice para la vista de Semana (0 = primera semana del mes, etc.)
  const [semanaIndice, setSemanaIndice] = useState<number>(0);

  // Sub-filtro para Quincena (1 = primera quincena 1-15, 2 = segunda quincena 16-fin)
  const [quincenaSeleccionada, setQuincenaSeleccionada] = useState<1 | 2>(1);

  // El panel de detalle inicia CERRADO para dar máximo espacio visual al calendario
  const [mostrarPanelDetalle, setMostrarPanelDetalle] = useState<boolean>(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState<DiaCalendarioInfo | null>(
    datosIniciales.diaSeleccionadoInicial || null
  );

  // Estados de animación fluida para el panel lateral (contador progresivo y aparición escalonada)
  const [minutosAnimados, setMinutosAnimados] = useState<number>(0);
  const [progresoBarraDetalle, setProgresoBarraDetalle] = useState<number>(0);
  const [animKey, setAnimKey] = useState<number>(0);
  const [anilloHoyMontado, setAnilloHoyMontado] = useState<boolean>(false);

  const [tabResumen, setTabResumen] = useState<"resumen" | "horario">("resumen");
  const [fotoModal, setFotoModal] = useState<{
    url: string;
    titulo: string;
    hora: string;
    lugar: string;
    similitudFacial?: number;
    validacion?: string;
  } | null>(null);

  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Inicializar hora de sincronización local y animación inicial del anillo de HOY
  useEffect(() => {
    setUltimaSincronizacion(
      new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    );
    const t = setTimeout(() => setAnilloHoyMontado(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Animación fluida del contador de horas/minutos trabajados y barra de progreso al abrir o cambiar día
  useEffect(() => {
    if (!mostrarPanelDetalle || !diaSeleccionado) {
      setProgresoBarraDetalle(0);
      return;
    }

    setAnimKey((prev) => prev + 1);
    const metaMinutos = diaSeleccionado.minutosTrabajados || 0;
    const porcentajeMeta = Math.min(100, Math.round((metaMinutos / 480) * 100));

    // Respetar prefers-reduced-motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setMinutosAnimados(metaMinutos);
      setProgresoBarraDetalle(porcentajeMeta);
      return;
    }

    setMinutosAnimados(0);
    setProgresoBarraDetalle(0);

    const timerBarra = setTimeout(() => {
      setProgresoBarraDetalle(porcentajeMeta);
    }, 60);

    if (metaMinutos <= 0) {
      return () => clearTimeout(timerBarra);
    }

    let rafId = 0;
    const duracionMs = 680;
    const inicio = performance.now();

    const step = (ahora: number) => {
      const transcurrido = ahora - inicio;
      const t = Math.min(1, transcurrido / duracionMs);
      // Curva cubic ease-out idéntica al video de referencia
      const eased = 1 - Math.pow(1 - t, 3);
      setMinutosAnimados(Math.round(metaMinutos * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setMinutosAnimados(metaMinutos);
      }
    };

    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerBarra);
    };
  }, [mostrarPanelDetalle, diaSeleccionado]);

  // Cerrar panel lateral con tecla Escape
  useEffect(() => {
    if (!mostrarPanelDetalle) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !fotoModal) {
        setMostrarPanelDetalle(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mostrarPanelDetalle, fotoModal]);

  // Función para recargar datos con feedback
  const cargarDatos = useCallback(
    (empId: string, mes: number, anio: number, notificar = false) => {
      startTransition(async () => {
        const res = await obtenerDatosRegistroJornadaDashboard({
          empleadoId: empId,
          mes,
          anio,
        });

        if (res.success && res.datos) {
          setDatos(res.datos);
          setUltimaSincronizacion(
            new Date().toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            })
          );

          // Si el panel de detalle estaba abierto, actualizar la información del día seleccionado
          if (diaSeleccionado) {
            const diaActualizado = res.datos.diasCalendario.find(
              (d) => d.fecha === diaSeleccionado.fecha
            );
            if (diaActualizado) {
              setDiaSeleccionado(diaActualizado);
            }
          }

          if (notificar) {
            notify.success(
              "Tablero actualizado",
              `Datos sincronizados con éxito a las ${new Date().toLocaleTimeString("es-MX")}`
            );
          }
        } else {
          notify.error("Error al cargar jornada", res.error || "No se pudo consultar el empleado.");
        }
      });
    },
    [diaSeleccionado]
  );

  // Suscripción en Tiempo Real con Supabase Realtime a la tabla `asistencias`
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard_jornada_realtime_feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "asistencias",
        },
        () => {
          cargarDatos(empleadoSeleccionadoId, mesActual, anioActual, false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empleadoSeleccionadoId, mesActual, anioActual, cargarDatos]);

  // Minutos actuales en America/Merida para el indicador en tiempo real estilo Google Calendar
  const [minutosActualesMerida, setMinutosActualesMerida] = useState<number | null>(null);

  useEffect(() => {
    function actualizarMinutos() {
      try {
        const formateador = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Merida",
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        });
        const partes = formateador.formatToParts(new Date());
        const h = Number(partes.find((p) => p.type === "hour")?.value || 0);
        const m = Number(partes.find((p) => p.type === "minute")?.value || 0);
        setMinutosActualesMerida(h * 60 + m);
      } catch {
        const ahora = new Date();
        setMinutosActualesMerida(ahora.getHours() * 60 + ahora.getMinutes());
      }
    }
    actualizarMinutos();
    const interval = setInterval(actualizarMinutos, 30000);
    return () => clearInterval(interval);
  }, []);

  // Agrupar días del mes en semanas estilo Google Calendar (7 columnas: Domingo a Sábado)
  const semanasDelMes = useMemo(() => {
    if (!datos.diasCalendario || datos.diasCalendario.length === 0) return [];

    const semanas: DiaCalendarioInfo[][] = [];
    const primerDiaMes = new Date(Date.UTC(anioActual, mesActual - 1, 1, 12, 0, 0));
    const primerDiaSemana = primerDiaMes.getUTCDay(); // 0 = Domingo, 1 = Lunes, etc.
    const ultimoDiaMes = new Date(Date.UTC(anioActual, mesActual, 0, 12, 0, 0)).getUTCDate();

    const mapaDias = new Map<number, DiaCalendarioInfo>();
    datos.diasCalendario.forEach((d) => mapaDias.set(d.numeroDia, d));

    let diaCursor = 1 - primerDiaSemana;

    while (diaCursor <= ultimoDiaMes) {
      const semana: DiaCalendarioInfo[] = [];
      for (let col = 0; col < 7; col++) {
        const numDia = diaCursor;
        if (numDia >= 1 && numDia <= ultimoDiaMes) {
          const diaEncontrado = mapaDias.get(numDia);
          if (diaEncontrado) {
            semana.push(diaEncontrado);
          } else {
            semana.push({
              fecha: `${anioActual}-${String(mesActual).padStart(2, "0")}-${String(numDia).padStart(2, "0")}`,
              numeroDia: numDia,
              diaSemana: col,
              diaNombreCorto: ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"][col],
              esHoy: false,
              esFuturo: false,
              esDescanso: col === 0,
              estado: col === 0 ? "DESCANSO" : "SIN_DATOS",
              badgeTexto: col === 0 ? "Descanso" : "Sin registros",
              horasTrabajadasStr: "0 h",
              minutosTrabajados: 0,
              minutosRetardo: 0,
              horasExtras: 0,
              eventos: [],
            });
          }
        } else {
          const fechaObj = new Date(Date.UTC(anioActual, mesActual - 1, numDia, 12, 0, 0));
          const y = fechaObj.getUTCFullYear();
          const m = String(fechaObj.getUTCMonth() + 1).padStart(2, "0");
          const d = String(fechaObj.getUTCDate()).padStart(2, "0");
          semana.push({
            fecha: `${y}-${m}-${d}`,
            numeroDia: fechaObj.getUTCDate(),
            diaSemana: col,
            diaNombreCorto: ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"][col],
            esHoy: false,
            esFuturo: true,
            esDescanso: col === 0,
            estado: "DESCANSO",
            badgeTexto: "Otro mes",
            horasTrabajadasStr: "0 h",
            minutosTrabajados: 0,
            minutosRetardo: 0,
            horasExtras: 0,
            eventos: [],
          });
        }
        diaCursor++;
      }
      semanas.push(semana);
      if (diaCursor > ultimoDiaMes) break;
    }

    return semanas;
  }, [datos.diasCalendario, anioActual, mesActual]);

  // Asegurar que semanaIndice esté en rango válido al cambiar de mes
  useEffect(() => {
    if (semanaIndice >= semanasDelMes.length) {
      setSemanaIndice(Math.max(0, semanasDelMes.length - 1));
    }
  }, [semanasDelMes.length, semanaIndice]);

  // Días para la vista Quincena
  const diasQuincena = useMemo(() => {
    if (quincenaSeleccionada === 1) {
      return datos.diasCalendario.filter((d) => d.numeroDia <= 15);
    }
    return datos.diasCalendario.filter((d) => d.numeroDia > 15);
  }, [datos.diasCalendario, quincenaSeleccionada]);

  // Navegación estilo Google Calendar (< / >) según el modo de vista activo
  function navegarAnterior() {
    if (modoVista === "semana") {
      if (semanaIndice > 0) {
        setSemanaIndice(semanaIndice - 1);
      } else {
        cambiarMes(-1, true);
      }
    } else if (modoVista === "quincena") {
      if (quincenaSeleccionada === 2) {
        setQuincenaSeleccionada(1);
      } else {
        setQuincenaSeleccionada(2);
        cambiarMes(-1, false);
      }
    } else {
      cambiarMes(-1);
    }
  }

  function navegarSiguiente() {
    if (modoVista === "semana") {
      if (semanaIndice < semanasDelMes.length - 1) {
        setSemanaIndice(semanaIndice + 1);
      } else {
        cambiarMes(1, false);
      }
    } else if (modoVista === "quincena") {
      if (quincenaSeleccionada === 1) {
        setQuincenaSeleccionada(2);
      } else {
        setQuincenaSeleccionada(1);
        cambiarMes(1, false);
      }
    } else {
      cambiarMes(1);
    }
  }

  // Botón "Hoy" estilo Google Calendar
  function irAHoy() {
    const ahora = new Date();
    const mesHoy = ahora.getMonth() + 1;
    const anioHoy = ahora.getFullYear();

    setMesActual(mesHoy);
    setAnioActual(anioHoy);

    const diaHoy = datos.diasCalendario.find((d) => d.esHoy);
    if (diaHoy) {
      setDiaSeleccionado(diaHoy);
      setMostrarPanelDetalle(true);

      // Si está en vista semana, posicionar semana que contiene a hoy
      const idxSemana = semanasDelMes.findIndex((sem) => sem.some((d) => d.esHoy));
      if (idxSemana !== -1) setSemanaIndice(idxSemana);

      // Si está en quincena, posicionar quincena 1 o 2
      setQuincenaSeleccionada(diaHoy.numeroDia <= 15 ? 1 : 2);
    }

    cargarDatos(empleadoSeleccionadoId, mesHoy, anioHoy);
  }

  function cambiarMes(delta: number, irAlFinalDeSemana = false) {
    let nuevoMes = mesActual + delta;
    let nuevoAnio = anioActual;

    if (nuevoMes > 12) {
      nuevoMes = 1;
      nuevoAnio += 1;
    } else if (nuevoMes < 1) {
      nuevoMes = 12;
      nuevoAnio -= 1;
    }

    setMesActual(nuevoMes);
    setAnioActual(nuevoAnio);
    setSemanaIndice(irAlFinalDeSemana ? 4 : 0);
    cargarDatos(empleadoSeleccionadoId, nuevoMes, nuevoAnio);
  }

  function handleSeleccionarEmpleado(empId: string) {
    setEmpleadoSeleccionadoId(empId);
    cargarDatos(empId, mesActual, anioActual);
  }

  // Al hacer clic en un día en CUALQUIERA de las vistas, se selecciona y se DESPLIEGA el detalle
  function handleSeleccionarDia(dia: DiaCalendarioInfo) {
    setDiaSeleccionado(dia);
    setMostrarPanelDetalle(true);
  }

  // Navegar entre el día anterior y siguiente directamente desde el encabezado del panel lateral (< / >)
  function navegarDiaDetalle(delta: -1 | 1) {
    if (!diaSeleccionado || datos.diasCalendario.length === 0) return;
    const idxActual = datos.diasCalendario.findIndex(
      (d) => d.fecha === diaSeleccionado.fecha
    );
    if (idxActual === -1) return;
    const nuevoIdx = idxActual + delta;
    if (nuevoIdx >= 0 && nuevoIdx < datos.diasCalendario.length) {
      setDiaSeleccionado(datos.diasCalendario[nuevoIdx]);
      setMostrarPanelDetalle(true);
    }
  }

  // Cerrar el panel de detalle para restaurar el máximo ancho del calendario
  function handleCerrarDetalle() {
    setMostrarPanelDetalle(false);
  }

  // Texto animado de horas y minutos trabajados (ej. "7 h 56 min")
  const horasTrabajadasAnimadasStr = useMemo(() => {
    if (!diaSeleccionado || diaSeleccionado.minutosTrabajados <= 0) return "0 h 00 min";
    const h = Math.floor(minutosAnimados / 60);
    const m = minutosAnimados % 60;
    return `${h} h ${String(m).padStart(2, "0")} min`;
  }, [diaSeleccionado, minutosAnimados]);

  // Régimen horario dinámico del día seleccionado para el pie del panel ("TU HORARIO" y "TOLERANCIA")
  const regimenDiaSeleccionado = useMemo(() => {
    const cfg = datos.horarioLaboralConfig || HORARIO_LABORAL_DEFAULT;
    if (!diaSeleccionado) {
      return {
        horarioTexto: `${cfg.semanal.horaEntrada} a ${cfg.semanal.horaSalida}`,
        toleranciaTexto: `${cfg.semanal.toleranciaEntradaMinutos} min`,
      };
    }
    const reg = evaluarConfiguracionPorDiaSemana(diaSeleccionado.diaSemana, cfg);
    if (reg.esDescanso) {
      return {
        horarioTexto: "Descanso LFT",
        toleranciaTexto: `${reg.toleranciaMinutos} min`,
      };
    }
    return {
      horarioTexto: `${reg.horaEntrada} a ${reg.horaSalida}`,
      toleranciaTexto: `${reg.toleranciaMinutos} min`,
    };
  }, [diaSeleccionado, datos.horarioLaboralConfig]);

  // Primer día de la semana del mes para el offset en la cuadrícula (0 = Domingo)
  const primerDiaSemanaMes = datos.diasCalendario.length > 0 ? datos.diasCalendario[0].diaSemana : 0;
  // Offset lunes-inicio: Domingo=6, Lunes=0, Martes=1, etc.
  const offsetLunesInicio = (primerDiaSemanaMes + 6) % 7;

  // Gauge circular de HOY con animación suave de entrada
  const radioCirculo = 42;
  const circunferenciaCirculo = 2 * Math.PI * radioCirculo;
  const strokeOffset = anilloHoyMontado
    ? circunferenciaCirculo - (datos.hoy.porcentajeJornada / 100) * circunferenciaCirculo
    : circunferenciaCirculo;

  // Extracción de eventos clave de Entrada y Salida para el Google Map del día seleccionado
  const eventoEntrada = diaSeleccionado?.eventos.find((e) => e.tipo === "ENTRADA");
  const eventoSalida = [...(diaSeleccionado?.eventos || [])]
    .reverse()
    .find((e) => e.tipo === "SALIDA");

  // Título dinámico del período según la vista activa estilo Google Calendar
  const tituloPeriodo = useMemo(() => {
    if (modoVista === "semana") {
      const diasSemana = semanasDelMes[semanaIndice] || [];
      if (diasSemana.length === 0) return `${datos.resumenMes.mesNombre} ${datos.resumenMes.anio}`;
      const primer = diasSemana[0].numeroDia;
      const ultimo = diasSemana[diasSemana.length - 1].numeroDia;
      return `${primer} – ${ultimo} de ${datos.resumenMes.mesNombre} ${datos.resumenMes.anio} (Semana ${semanaIndice + 1})`;
    }

    if (modoVista === "quincena") {
      return `${quincenaSeleccionada === 1 ? "1ª Quincena (1 – 15)" : "2ª Quincena (16 – fin)"} de ${datos.resumenMes.mesNombre} ${datos.resumenMes.anio}`;
    }

    if (modoVista === "lista") {
      return `Agenda Mensual: ${datos.resumenMes.mesNombre} ${datos.resumenMes.anio}`;
    }

    return `${datos.resumenMes.mesNombre} ${datos.resumenMes.anio}`;
  }, [modoVista, semanaIndice, semanasDelMes, quincenaSeleccionada, datos.resumenMes]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* =========================================================================
          1. HEADER BAR ESTILO GOOGLE CALENDAR (NAVEGACIÓN HOY, <, >, SELECTOR DE VISTAS)
         ========================================================================= */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between bg-white p-4 sm:p-5 rounded-3xl border border-zinc-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            <CalendarIcon className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                Registro Electrónico de Jornada
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                LFT Art. 132
              </span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                En vivo
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Supervisión de jornadas, descansos intermedios y ubicación de marcajes en Google Maps.
            </p>
          </div>
        </div>

        {/* Barra de Controles y Selector de Modo de Vista Estilo Google Calendar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de Empleado */}
          <div className="relative">
            <select
              value={empleadoSeleccionadoId}
              onChange={(e) => handleSeleccionarEmpleado(e.target.value)}
              disabled={isPending}
              className="appearance-none rounded-xl border border-zinc-200 bg-zinc-50/80 pl-8 pr-8 py-1.5 text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900 hover:bg-zinc-100/70 transition-colors cursor-pointer shadow-2xs"
            >
              {datos.empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.numero_empleado} — {emp.nombre} {emp.apellidos}
                </option>
              ))}
            </select>
            <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
          </div>

          {/* Botón de Actualizar en Vivo (como lo tenía antes) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => cargarDatos(empleadoSeleccionadoId, mesActual, anioActual, true)}
            disabled={isPending}
            className="rounded-xl border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title={`Última sincronización: ${ultimaSincronizacion}`}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-zinc-600 ${isPending ? "animate-spin text-emerald-600" : ""}`}
            />
            <span className="hidden sm:inline">
              {isPending ? "Actualizando..." : "Actualizar en vivo"}
            </span>
          </Button>

          {/* Selector de Modo de Vista Estilo Google Calendar (Mes | Semana | Quincena | Lista) */}
          <div className="flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200 text-xs font-medium">
            <button
              onClick={() => setModoVista("mes")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                modoVista === "mes"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => setModoVista("semana")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                modoVista === "semana"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setModoVista("quincena")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                modoVista === "quincena"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Quincena
            </button>
            <button
              onClick={() => setModoVista("lista")}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                modoVista === "lista"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <ListIcon className="h-3 w-3" />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. ESTRUCTURA PRINCIPAL CON EFECTO DE PROFUNDIDAD Y ATENUACIÓN SUAVE
             CUANDO EL PANEL LATERAL INTERACTIVO ESTÁ ACTIVO
         ========================================================================= */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-6 items-start transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mostrarPanelDetalle
            ? "lg:opacity-80 lg:brightness-[0.97] lg:scale-[0.996]"
            : "opacity-100 scale-100"
        }`}
      >
        {/* =====================================================================
            COLUMNA IZQUIERDA: TARJETA "HOY" + RESUMEN MENSUAL
           ===================================================================== */}
        <div className="lg:col-span-4 space-y-5 transition-all duration-300">
          {/* Tarjeta HOY — EN JORNADA */}
          <Card className="rounded-3xl border-zinc-200 shadow-2xs overflow-hidden bg-white">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    HOY
                  </span>
                  <h3 className="text-xs font-bold text-zinc-900">
                    {datos.hoy.fechaLegible}
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold px-2 py-0.5 gap-1.5 ${
                    datos.hoy.enJornada
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-zinc-100 text-zinc-700 border-zinc-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      datos.hoy.enJornada ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                    }`}
                  />
                  {datos.hoy.enJornada ? "EN JORNADA" : "SIN JORNADA"}
                </Badge>
              </div>

              {/* Medidor Circular de Progreso */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="relative flex items-center justify-center">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r={radioCirculo}
                      className="stroke-zinc-100"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r={radioCirculo}
                      className="stroke-emerald-600 transition-all duration-1000 ease-out"
                      strokeWidth="8"
                      strokeDasharray={circunferenciaCirculo}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-black text-zinc-900 tracking-tight leading-none">
                      {datos.hoy.horasTrabajadasStr}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium mt-0.5">
                      de 8 h
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-right">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Entrada</span>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs font-bold text-zinc-900 font-mono">
                        {datos.hoy.entradaReal || "--:--"}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                        A tiempo
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Salida Programada</span>
                    <span className="text-xs font-bold text-zinc-900 font-mono">
                      {datos.hoy.salidaProgramada}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
                <span>Horario: {datos.hoy.horarioProgramado}</span>
                <button
                  type="button"
                  onClick={() => {
                    const diaHoy = datos.diasCalendario.find((d) => d.esHoy);
                    if (diaHoy) handleSeleccionarDia(diaHoy);
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5 text-[11px] cursor-pointer"
                >
                  Ver registros de hoy
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Tarjeta Resumen del Mes / Mi Horario */}
          <Card className="rounded-3xl border-zinc-200 shadow-2xs overflow-hidden bg-white">
            <CardContent className="p-5 space-y-4">
              {/* Selector Tabs: Resumen vs Mi Horario */}
              <div className="flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200 text-xs font-medium">
                <button
                  onClick={() => setTabResumen("resumen")}
                  className={`flex-1 py-1 rounded-lg transition-all text-center cursor-pointer ${
                    tabResumen === "resumen"
                      ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Resumen
                </button>
                <button
                  onClick={() => setTabResumen("horario")}
                  className={`flex-1 py-1 rounded-lg transition-all text-center cursor-pointer ${
                    tabResumen === "horario"
                      ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Mi horario
                </button>
              </div>

              {tabResumen === "resumen" ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900">
                      {datos.resumenMes.mesNombre} {datos.resumenMes.anio}
                    </span>
                    <span className="text-[10px] text-zinc-400">Cómputo mensual LFT</span>
                  </div>

                  {/* Cuadrícula de 6 métricas clave */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <span className="text-lg font-black text-zinc-900 block leading-tight">
                        {datos.resumenMes.diasTrabajados}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        días trabajados
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <span className="text-lg font-black text-zinc-900 block leading-tight">
                        {datos.resumenMes.horasTrabajadasTotalStr}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        horas trabajadas
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <span
                        className={`text-lg font-black block leading-tight ${
                          datos.resumenMes.totalRetardos > 0 ? "text-amber-700" : "text-zinc-900"
                        }`}
                      >
                        {datos.resumenMes.totalRetardos}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        retardos
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <span
                        className={`text-lg font-black block leading-tight ${
                          datos.resumenMes.totalFaltas > 0 ? "text-rose-700" : "text-zinc-900"
                        }`}
                      >
                        {datos.resumenMes.totalFaltas}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        faltas
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <span className="text-lg font-black text-amber-900 block leading-tight">
                        {datos.resumenMes.totalHorasExtraStr}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        horas extra
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <span className="text-lg font-black text-zinc-700 block leading-tight">
                        {datos.resumenMes.totalMinutosRetardo} min
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        minutos de retardo
                      </span>
                    </div>
                  </div>

                  {/* Indicadores segmentados + Barra de Puntualidad */}
                  <div className="space-y-2 pt-2 border-t border-zinc-100">
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="h-1.5 rounded-full bg-emerald-500/80 transition-all duration-500" />
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          datos.resumenMes.totalRetardos > 0 ? "bg-amber-400" : "bg-emerald-500/50"
                        }`}
                      />
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          datos.resumenMes.totalFaltas > 0 ? "bg-rose-400" : "bg-zinc-200"
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-zinc-600">Puntualidad</span>
                      <span className="font-bold text-emerald-800">
                        {datos.resumenMes.porcentajePuntualidad}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${datos.resumenMes.porcentajePuntualidad}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                (() => {
                  const cfg = datos.horarioLaboralConfig || HORARIO_LABORAL_DEFAULT;
                  const diasEspecial = obtenerDiasSegundoHorario(cfg);
                  const diasDescanso = obtenerDiasDescanso(cfg);

                  return (
                    <div className="space-y-3 text-xs text-zinc-600">
                      <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                        <span className="font-bold text-zinc-900 block">Jornada Oficial Configurada</span>
                        <p className="text-[11px] text-zinc-600">
                          <strong>{formatearResumenDias(cfg.semanal.dias)}:</strong> {cfg.semanal.horaEntrada} a {cfg.semanal.horaSalida} hrs
                        </p>
                        {diasEspecial.length > 0 && (
                          <p className="text-[11px] text-zinc-600">
                            <strong>{formatearResumenDias(diasEspecial)}:</strong> {cfg.finDeSemana.horaEntradaSabado} a {cfg.finDeSemana.horaSalidaSabado} hrs
                          </p>
                        )}
                        <p className="text-[11px] text-zinc-500">
                          <strong>Descanso:</strong> {formatearResumenDias(diasDescanso)}
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                        <span className="font-bold text-zinc-900 block">Tolerancia y Horas Extras</span>
                        <p className="text-[11px] text-zinc-500">
                          Tolerancia de entrada: {cfg.semanal.toleranciaEntradaMinutos} min
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Activación de horas extras: &ge; {cfg.horasExtras.minutosMinimosToleranciaSalida} min post-salida
                        </p>
                      </div>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </div>

        {/* =====================================================================
            COLUMNA CENTRAL: VISTAS ESTILO GOOGLE CALENDAR (MES, SEMANA, QUINCENA, LISTA)
           ===================================================================== */}
        <div className="lg:col-span-8 space-y-4 transition-all duration-300">
          <Card className="rounded-3xl border-zinc-200 shadow-2xs overflow-hidden bg-white">
            <CardContent className="p-5 sm:p-6 space-y-5">
              {/* Cabecera Estilo Google Calendar: Botón "Hoy", Flechas < y >, y Título del Período */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  {/* Botón "Hoy" estilo Google Calendar */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={irAHoy}
                    className="rounded-xl border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer h-8 px-3"
                  >
                    Hoy
                  </Button>

                  {/* Flechas de Navegación < y > */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={navegarAnterior}
                      disabled={isPending}
                      className="h-8 w-8 p-0 rounded-xl cursor-pointer"
                      title="Período anterior"
                    >
                      <ChevronLeft className="h-4 w-4 text-zinc-600" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={navegarSiguiente}
                      disabled={isPending}
                      className="h-8 w-8 p-0 rounded-xl cursor-pointer"
                      title="Período siguiente"
                    >
                      <ChevronRight className="h-4 w-4 text-zinc-600" />
                    </Button>
                  </div>

                  {/* Título dinámico del período */}
                  <div className="flex items-center gap-2 ml-1">
                    <h2 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight">
                      {tituloPeriodo}
                    </h2>
                    {isPending && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
                  </div>
                </div>

                {/* Si el panel de detalle está abierto, botón para volver a maximizar */}
                {mostrarPanelDetalle && (
                  <button
                    type="button"
                    onClick={handleCerrarDetalle}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer shrink-0 inline-flex items-center gap-1"
                  >
                    <Maximize2 className="h-3 w-3" />
                    Maximizar Vista
                  </button>
                )}
              </div>

              {/* Leyenda de Estados */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500 pt-0.5 pb-1 border-b border-zinc-100">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Asistió a tiempo
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Retardo
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Permiso / Vacaciones
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Inasistencia
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-zinc-300" />
                  Descanso
                </span>
              </div>

              {/* =============================================================
                  VISTA 1: MES COMPLETO (CUADRÍCULA ESTILO GOOGLE CALENDAR)
                 ============================================================= */}
              {modoVista === "mes" && (
                <div className="grid grid-cols-7 gap-2 sm:gap-2.5 text-center">
                  {/* Encabezados de días */}
                  {["L", "M", "M", "J", "V", "S", "D"].map((dNom, idx) => (
                    <div key={idx} className="text-xs font-bold text-zinc-400 py-1">
                      {dNom}
                    </div>
                  ))}

                  {/* Días vacíos de offset del inicio de mes */}
                  {Array.from({ length: offsetLunesInicio }).map((_, idx) => (
                    <div
                      key={`empty-${idx}`}
                      className="h-14 sm:h-16 rounded-2xl opacity-10 bg-zinc-100"
                    />
                  ))}

                  {/* Días del mes con interactividad táctil y visual */}
                  {datos.diasCalendario.map((dia) => {
                    const estaSeleccionado = diaSeleccionado?.fecha === dia.fecha && mostrarPanelDetalle;

                    let barraBg = "bg-transparent";
                    if (dia.estado === "A_TIEMPO") barraBg = "bg-emerald-500";
                    else if (dia.estado === "RETARDO") barraBg = "bg-amber-500";
                    else if (dia.estado === "VACACIONES" || dia.estado === "PERMISO") barraBg = "bg-blue-500";
                    else if (dia.estado === "EN_CURSO") barraBg = "bg-emerald-400 animate-pulse";
                    else if (dia.estado === "FALTA") barraBg = "bg-rose-500";
                    else if (dia.esDescanso) barraBg = "bg-zinc-200";

                    return (
                      <button
                        key={dia.fecha}
                        type="button"
                        onClick={() => handleSeleccionarDia(dia)}
                        className={`group h-14 sm:h-16 rounded-2xl p-2 flex flex-col items-center justify-between transition-all duration-200 ease-out relative cursor-pointer ${
                          estaSeleccionado
                            ? "bg-zinc-950 text-white shadow-lg ring-2 ring-emerald-500 scale-[1.03] z-10"
                            : dia.esHoy
                            ? "bg-blue-50 text-blue-900 border-2 border-blue-400 font-bold hover:-translate-y-0.5"
                            : dia.esDescanso
                            ? "text-zinc-300 hover:bg-zinc-50"
                            : "bg-zinc-50/70 text-zinc-800 hover:bg-zinc-100 hover:border-zinc-300 hover:-translate-y-0.5 border border-zinc-100"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full px-1">
                          <span className={`text-xs font-semibold ${estaSeleccionado ? "text-white" : ""}`}>
                            {dia.numeroDia}
                          </span>
                          {dia.eventos.length > 0 && !estaSeleccionado && (
                            <span className="text-[9px] text-zinc-400 font-mono">
                              {dia.eventos.length}m
                            </span>
                          )}
                        </div>

                        <span
                          className={`h-1.5 w-6 rounded-full transition-all duration-300 ${
                            estaSeleccionado ? "bg-emerald-400 w-7" : barraBg
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* =============================================================
                  VISTA 2: SEMANA (CALENDARIO COMPLETO ESTILO GOOGLE CALENDAR)
                 ============================================================= */}
              {modoVista === "semana" && (
                <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-300 touch-pan-x -mx-1 px-1">
                  <div className="min-w-[760px] sm:min-w-full border border-zinc-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    {/* 1. Cabecera de Días estilo Google Calendar (DOM, LUN, MAR, MIÉ, JUE, VIE, SÁB) */}
                    <div className="flex border-b border-zinc-200 bg-[#FAFAFC]">
                      {/* Columna de zona horaria / hora */}
                      <div className="w-14 sm:w-16 shrink-0 border-r border-zinc-200/80 bg-zinc-100/60 flex flex-col justify-end p-2 text-right sticky left-0 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.03)]">
                        <span className="text-[10px] font-mono font-bold text-zinc-500">GMT-6</span>
                      </div>

                      {/* 7 Columnas de Días */}
                      <div className="grid grid-cols-7 flex-1">
                        {(semanasDelMes[semanaIndice] || []).map((dia, idx) => {
                          const estaSeleccionado =
                            diaSeleccionado?.fecha === dia.fecha && mostrarPanelDetalle;

                          return (
                            <button
                              key={dia.fecha || idx}
                              type="button"
                              onClick={() => handleSeleccionarDia(dia)}
                              className={`p-2.5 text-center border-r last:border-r-0 border-zinc-200/70 transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                estaSeleccionado
                                  ? "bg-zinc-950 text-white"
                                  : dia.esHoy
                                  ? "bg-blue-50/60"
                                  : "hover:bg-zinc-100/70"
                              }`}
                            >
                              <span
                                className={`text-[11px] font-bold uppercase tracking-wider ${
                                  dia.esHoy
                                    ? "text-blue-600 font-extrabold"
                                    : estaSeleccionado
                                    ? "text-zinc-300"
                                    : "text-zinc-500"
                                }`}
                              >
                                {["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"][dia.diaSemana]}
                              </span>

                              <span
                                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all ${
                                  dia.esHoy
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : estaSeleccionado
                                    ? "bg-zinc-800 text-white ring-2 ring-emerald-400"
                                    : "text-zinc-800"
                                }`}
                              >
                                {dia.numeroDia}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Fila de Eventos de Todo el Día / Festivos / Descansos LFT */}
                    <div className="flex border-b border-zinc-200/80 bg-zinc-50/40 text-xs">
                      <div className="w-14 sm:w-16 shrink-0 border-r border-zinc-200/80 bg-zinc-100/40 p-1.5 text-right text-[10px] font-medium text-zinc-400 sticky left-0 z-20">
                        Todo el día
                      </div>

                      <div className="grid grid-cols-7 flex-1">
                        {(semanasDelMes[semanaIndice] || []).map((dia, idx) => {
                          const esFestivo = dia.fecha.endsWith("11-16"); // Día de la Revolución

                          return (
                            <div
                              key={`allday-${dia.fecha || idx}`}
                              onClick={() => handleSeleccionarDia(dia)}
                              className="p-1 border-r last:border-r-0 border-zinc-200/70 min-h-[30px] flex items-center cursor-pointer"
                            >
                              {esFestivo ? (
                                <span className="w-full bg-[#1B5E20] text-white text-[10px] font-semibold px-2 py-0.5 rounded-md truncate block shadow-2xs text-center">
                                  Día de la Revolución
                                </span>
                              ) : dia.esDescanso ? (
                                <span className="w-full bg-zinc-200/80 text-zinc-700 text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate block text-center">
                                  Descanso LFT
                                </span>
                              ) : dia.estado === "VACACIONES" ? (
                                <span className="w-full bg-blue-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate block text-center">
                                  Vacaciones
                                </span>
                              ) : dia.estado === "PERMISO" ? (
                                <span className="w-full bg-amber-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate block text-center">
                                  Permiso
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Rejilla Horaria Estilo Google Calendar (6 AM a 8 PM) */}
                    <div className="flex relative h-[750px] overflow-hidden bg-white">
                      {/* Eje de Horas Izquierdo Fijo */}
                      <div className="w-14 sm:w-16 shrink-0 border-r border-zinc-200/80 bg-zinc-50/30 sticky left-0 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.03)] select-none">
                        {HORAS_CALENDARIO.map((item) => (
                          <div
                            key={item.hora}
                            className="h-[50px] relative border-b border-zinc-100 text-right pr-2"
                          >
                            <span className="text-[10px] font-mono text-zinc-400 font-medium -top-2.5 right-2 absolute">
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 7 Columnas de la Semana con Líneas Horarias y Eventos */}
                      <div className="grid grid-cols-7 flex-1 relative">
                        {(semanasDelMes[semanaIndice] || []).map((dia, idx) => {
                          const estaSeleccionado =
                            diaSeleccionado?.fecha === dia.fecha && mostrarPanelDetalle;

                          // Cálculo de posicionamiento del evento de asistencia
                          const minEntrada = parseHoraAMinutos(dia.entradaHora);
                          const minSalida =
                            parseHoraAMinutos(dia.salidaHora) ||
                            (dia.estado === "EN_CURSO" && minutosActualesMerida !== null
                              ? minutosActualesMerida
                              : minEntrada !== null
                              ? minEntrada + 60
                              : null);

                          let topPct = 0;
                          let heightPct = 0;

                          if (minEntrada !== null) {
                            const clampEntrada = Math.max(360, Math.min(1260, minEntrada));
                            topPct = ((clampEntrada - 360) / 750) * 100;
                            const finCalculado = minSalida !== null ? minSalida : clampEntrada + 60;
                            const duracion = Math.max(finCalculado - clampEntrada, 40);
                            heightPct = Math.max(6, Math.min(100 - topPct, (duracion / 750) * 100));
                          }

                          return (
                            <div
                              key={`col-${dia.fecha || idx}`}
                              onClick={() => handleSeleccionarDia(dia)}
                              className={`relative border-r last:border-r-0 border-zinc-200/70 h-full cursor-pointer transition-colors ${
                                estaSeleccionado
                                  ? "bg-zinc-50/80"
                                  : dia.esHoy
                                  ? "bg-blue-50/20"
                                  : "hover:bg-zinc-50/40"
                              }`}
                            >
                              {/* Líneas horizontales de cada hora */}
                              {HORAS_CALENDARIO.map((h) => (
                                <div
                                  key={h.hora}
                                  className="h-[50px] border-b border-zinc-100/80 pointer-events-none"
                                />
                              ))}

                              {/* Indicador Rojo de Hora Actual estilo Google Calendar */}
                              {dia.esHoy &&
                                minutosActualesMerida !== null &&
                                minutosActualesMerida >= 360 &&
                                minutosActualesMerida <= 1260 && (
                                  <div
                                    style={{
                                      top: `${((minutosActualesMerida - 360) / 750) * 100}%`,
                                    }}
                                    className="absolute left-0 right-0 z-30 pointer-events-none flex items-center -mt-[1px]"
                                  >
                                    <div className="h-3 w-3 rounded-full bg-red-600 -ml-1.5 ring-2 ring-white shadow-xs shrink-0" />
                                    <div className="h-[2px] bg-red-600 w-full" />
                                  </div>
                                )}

                              {/* Tarjeta de Asistencia / Turno Laboral Estilo Google Calendar */}
                              {minEntrada !== null && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSeleccionarDia(dia);
                                  }}
                                  style={{
                                    top: `${topPct}%`,
                                    height: `${heightPct}%`,
                                  }}
                                  className={`absolute left-1 right-1 rounded-xl p-2 text-white shadow-sm cursor-pointer transition-all hover:brightness-105 z-10 flex flex-col justify-between overflow-hidden ${
                                    dia.estado === "A_TIEMPO"
                                      ? "bg-[#5C6BC0] border border-indigo-400/50"
                                      : dia.estado === "RETARDO"
                                      ? "bg-amber-600 border border-amber-400/50"
                                      : dia.estado === "EN_CURSO"
                                      ? "bg-emerald-600 border border-emerald-400/50 animate-pulse"
                                      : dia.estado === "FALTA"
                                      ? "bg-rose-600 border border-rose-400/50"
                                      : "bg-blue-600 border border-blue-400/50"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1 leading-none">
                                      <span className="text-[10px] font-bold uppercase tracking-tight truncate">
                                        {dia.horasTrabajadasStr !== "0 h"
                                          ? `Jornada ${dia.horasTrabajadasStr}`
                                          : "Jornada Laboral"}
                                      </span>
                                      {dia.horasExtras > 0 && (
                                        <span className="text-[8px] bg-emerald-300 text-zinc-950 px-1 py-0.5 rounded font-black shrink-0">
                                          +{dia.horasExtras}h ext
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-white/90 font-mono block mt-1">
                                      {dia.entradaHora}{" "}
                                      {dia.salidaHora ? `– ${dia.salidaHora}` : "– En curso"}
                                    </span>
                                  </div>

                                  <div className="text-[9px] text-white/80 flex items-center justify-between pt-1 border-t border-white/20">
                                    <span>{dia.eventos.length} marcaje(s)</span>
                                    <span className="font-semibold text-white">Ver mapa &rarr;</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================
                  VISTA 3: QUINCENA (1ª Y 2ª QUINCENA PARA NÓMINA MEXICANA)
                 ============================================================= */}
              {modoVista === "quincena" && (
                <div className="space-y-4">
                  {/* Selector rápido entre Quincena 1 y Quincena 2 */}
                  <div className="flex items-center justify-center gap-2 p-1 bg-zinc-100 rounded-2xl max-w-sm mx-auto text-xs">
                    <button
                      type="button"
                      onClick={() => setQuincenaSeleccionada(1)}
                      className={`flex-1 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                        quincenaSeleccionada === 1
                          ? "bg-white text-zinc-900 shadow-xs"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      1ª Quincena (Días 1 al 15)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuincenaSeleccionada(2)}
                      className={`flex-1 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                        quincenaSeleccionada === 2
                          ? "bg-white text-zinc-900 shadow-xs"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      2ª Quincena (Días 16 al fin)
                    </button>
                  </div>

                  {/* Cuadrícula de 15 Días */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {diasQuincena.map((dia) => {
                      const estaSeleccionado = diaSeleccionado?.fecha === dia.fecha && mostrarPanelDetalle;

                      return (
                        <div
                          key={dia.fecha}
                          onClick={() => handleSeleccionarDia(dia)}
                          className={`rounded-2xl p-3 border transition-all cursor-pointer flex flex-col justify-between ${
                            estaSeleccionado
                              ? "bg-zinc-950 text-white border-zinc-900 shadow-md ring-2 ring-emerald-500"
                              : dia.esHoy
                              ? "bg-blue-50 border-blue-300"
                              : dia.esDescanso
                              ? "bg-zinc-50 border-zinc-200/60 text-zinc-400"
                              : "bg-white border-zinc-200 hover:bg-zinc-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">Día {dia.numeroDia}</span>
                            <span className="text-[10px] font-semibold text-zinc-400">
                              {dia.diaNombreCorto}
                            </span>
                          </div>

                          <div className="my-2">
                            <span className="text-sm font-black block">
                              {dia.horasTrabajadasStr !== "0 h" ? dia.horasTrabajadasStr : "--"}
                            </span>
                            <span className="text-[10px] text-zinc-500 truncate block">
                              {dia.badgeTexto}
                            </span>
                          </div>

                          <div className="text-[9px] text-zinc-400 pt-1 border-t border-zinc-100 flex items-center justify-between">
                            <span>{dia.entradaHora || "Sin entrada"}</span>
                            <span>{dia.salidaHora || ""}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* =============================================================
                  VISTA 4: AGENDA / LISTA CRONOLÓGICA COMPLETA DEL MES
                 ============================================================= */}
              {modoVista === "lista" && (
                <div className="space-y-2 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-400 font-semibold text-[10px] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Estatus</th>
                        <th className="py-2.5 px-3">Entrada</th>
                        <th className="py-2.5 px-3">Salida</th>
                        <th className="py-2.5 px-3">Horas Efectivas</th>
                        <th className="py-2.5 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {datos.diasCalendario.map((dia) => {
                        const estaSeleccionado = diaSeleccionado?.fecha === dia.fecha && mostrarPanelDetalle;

                        return (
                          <tr
                            key={dia.fecha}
                            onClick={() => handleSeleccionarDia(dia)}
                            className={`transition-colors cursor-pointer ${
                              estaSeleccionado
                                ? "bg-zinc-900 text-white font-semibold"
                                : dia.esHoy
                                ? "bg-blue-50/60 hover:bg-blue-50"
                                : "hover:bg-zinc-50"
                            }`}
                          >
                            <td className="py-2.5 px-3 font-medium">
                              <span className="font-bold">{dia.numeroDia}</span>{" "}
                              <span className="text-zinc-500 text-[11px] font-normal">
                                ({dia.diaNombreCorto})
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold ${
                                  dia.estado === "A_TIEMPO"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : dia.estado === "RETARDO"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : dia.estado === "FALTA"
                                    ? "bg-rose-50 text-rose-800 border-rose-200"
                                    : dia.estado === "VACACIONES" || dia.estado === "PERMISO"
                                    ? "bg-blue-50 text-blue-800 border-blue-200"
                                    : "bg-zinc-100 text-zinc-600 border-zinc-200"
                                }`}
                              >
                                {dia.badgeTexto}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {dia.entradaHora || "--:--"}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {dia.salidaHora || "--:--"}
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              {dia.horasTrabajadasStr}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSeleccionarDia(dia);
                                }}
                                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                              >
                                Ver Detalle ↗
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Ficha rápida del empleado seleccionado */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-[10px] text-zinc-700">
                    {datos.empleadoSeleccionado.nombreCompleto.charAt(0)}
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900 block leading-tight">
                      {datos.empleadoSeleccionado.nombreCompleto}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {datos.empleadoSeleccionado.numeroEmpleado} • {datos.empleadoSeleccionado.puesto}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {datos.empleadoSeleccionado.curp || "CURP N/D"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* =========================================================================
          2.5. CAPA DE ATENUACIÓN Y PANEL LATERAL DESLIZANTE (SLIDE-OVER DERECHO)
               CON ANIMACIÓN ESCALONADA Y CONTADOR FLUIDO DE TIEMPO TRABAJADO
         ========================================================================= */}
      {/* Backdrop de atenuación suave (en móvil cierra al tocar; en escritorio permite seguir haciendo clic en días del calendario) */}
      <div
        onClick={handleCerrarDetalle}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-zinc-950/20 backdrop-blur-[1px] transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:pointer-events-none ${
          mostrarPanelDetalle && diaSeleccionado
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel Lateral Deslizante desde el extremo derecho */}
      <aside
        aria-label="Expediente diario de asistencia"
        aria-hidden={!mostrarPanelDetalle}
        className={`fixed top-0 right-0 bottom-0 z-40 w-full sm:w-[410px] md:w-[435px] bg-white border-l border-zinc-200/90 shadow-[-24px_0_60px_-12px_rgba(24,24,27,0.22)] flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mostrarPanelDetalle && diaSeleccionado
            ? "translate-x-0"
            : "translate-x-full pointer-events-none"
        }`}
      >
        {diaSeleccionado && (
          <>
            {/* 1. Cabecera Interactiva del Panel (< | DÍA / Fecha | > | ×) */}
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between gap-2 bg-white shrink-0 pt-safe">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => navegarDiaDetalle(-1)}
                  disabled={diaSeleccionado.numeroDia <= 1}
                  title="Día anterior"
                  className="h-8 w-8 rounded-xl border border-zinc-200/80 bg-zinc-50/70 hover:bg-zinc-100 disabled:opacity-35 flex items-center justify-center text-zinc-700 transition-all cursor-pointer shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block leading-none">
                    {new Date(diaSeleccionado.fecha + "T12:00:00.000Z").toLocaleDateString(
                      "es-MX",
                      { weekday: "long" }
                    )}
                  </span>
                  <h3 className="text-sm font-extrabold text-zinc-900 truncate mt-0.5 capitalize">
                    {new Date(diaSeleccionado.fecha + "T12:00:00.000Z").toLocaleDateString(
                      "es-MX",
                      { day: "numeric", month: "long" }
                    )}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => navegarDiaDetalle(1)}
                  disabled={diaSeleccionado.numeroDia >= datos.diasCalendario.length}
                  title="Día siguiente"
                  className="h-8 w-8 rounded-xl border border-zinc-200/80 bg-zinc-50/70 hover:bg-zinc-100 disabled:opacity-35 flex items-center justify-center text-zinc-700 transition-all cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleCerrarDetalle}
                  title="Cerrar panel (Esc)"
                  className="h-8 w-8 rounded-xl border border-zinc-200/80 bg-zinc-50/70 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 flex items-center justify-center text-zinc-500 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Cuerpo Desplazable con Animaciones Progresivas */}
            <div
              key={`panel-body-${animKey}`}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-5 touch-scroll"
            >
              {/* 2. Tarjeta Hero Ejecutiva con Contador Progresivo y Barra de Progreso */}
              <div
                style={{ animationDelay: "30ms" }}
                className="animate-nolan-stagger p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white shadow-lg border border-zinc-800/90 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Columna Izquierda Hero: Badge de Estado + Contador Animado + Barra */}
                  <div className="space-y-2.5 min-w-0">
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          diaSeleccionado.estado === "RETARDO"
                            ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                            : diaSeleccionado.estado === "A_TIEMPO" ||
                              diaSeleccionado.estado === "EN_CURSO"
                            ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                            : diaSeleccionado.estado === "FALTA"
                            ? "bg-rose-400/20 text-rose-300 border border-rose-400/30"
                            : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                        }`}
                      >
                        {diaSeleccionado.estado === "RETARDO"
                          ? `RETARDO ${diaSeleccionado.minutosRetardo} MIN`
                          : diaSeleccionado.badgeTexto.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-2xl sm:text-[28px] font-black tracking-tight text-white tabular-nums leading-none">
                      {horasTrabajadasAnimadasStr}
                    </p>

                    {/* Barra de progreso horizontal animada */}
                    <div className="h-1.5 w-36 sm:w-44 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          diaSeleccionado.estado === "RETARDO"
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                        }`}
                        style={{ width: `${progresoBarraDetalle}%` }}
                      />
                    </div>
                  </div>

                  {/* Columna Derecha Hero: ENTRADA y SALIDA */}
                  <div className="text-right space-y-2 shrink-0">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 block">
                        ENTRADA
                      </span>
                      <span className="text-sm font-mono font-extrabold text-white block leading-tight">
                        {diaSeleccionado.entradaHora || "--:--"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 block">
                        SALIDA
                      </span>
                      <span className="text-sm font-mono font-extrabold text-white block leading-tight">
                        {diaSeleccionado.salidaHora || "--:--"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Mapa Oficial de Google Maps con Aparición Progresiva */}
              <div
                style={{ animationDelay: "110ms" }}
                className="animate-nolan-stagger"
              >
                <GoogleMapMarcajes
                  eventoEntrada={eventoEntrada}
                  eventoSalida={eventoSalida}
                  configTaller={datos.configuracionTaller}
                />
              </div>

              {/* 4. Cronología Escalonada de Registros ("Tus registros" + X guardados) */}
              <div className="space-y-3 pt-1">
                <div
                  style={{ animationDelay: "170ms" }}
                  className="animate-nolan-stagger flex items-center justify-between"
                >
                  <span className="text-xs font-extrabold text-zinc-900">
                    Tus registros
                  </span>
                  <span className="text-[11px] font-medium text-zinc-400">
                    {diaSeleccionado.eventos.length}{" "}
                    {diaSeleccionado.eventos.length === 1 ? "guardado" : "guardados"}
                  </span>
                </div>

                {diaSeleccionado.eventos.length === 0 ? (
                  <div
                    style={{ animationDelay: "220ms" }}
                    className="animate-nolan-stagger py-8 text-center text-zinc-400 text-xs bg-zinc-50/80 rounded-2xl border border-dashed border-zinc-200"
                  >
                    No se registran eventos de asistencia en esta fecha.
                  </div>
                ) : (
                  <div className="relative pt-1">
                    {diaSeleccionado.eventos.map((ev, idx) => {
                      const esUltimo = idx === diaSeleccionado.eventos.length - 1;
                      const delayBadge = 200 + idx * 115;
                      const delayContent = 220 + idx * 115;
                      const delayConnector = 260 + idx * 115;

                      const verboEvento =
                        ev.tipo === "ENTRADA"
                          ? "Entraste"
                          : ev.tipo === "INICIO_DESCANSO"
                          ? "Saliste a descanso"
                          : ev.tipo === "FIN_DESCANSO"
                          ? "Regresaste"
                          : "Saliste";

                      const badgeColorClass =
                        ev.tipo === "ENTRADA"
                          ? "bg-emerald-600 text-white shadow-emerald-600/20"
                          : ev.tipo === "INICIO_DESCANSO"
                          ? "bg-zinc-800 text-white shadow-zinc-800/20"
                          : ev.tipo === "FIN_DESCANSO"
                          ? "bg-emerald-500 text-white shadow-emerald-500/20"
                          : "bg-zinc-950 text-white shadow-zinc-950/20";

                      return (
                        <div key={ev.numero} className="relative flex items-start gap-3.5">
                          {/* Columna Izquierda: Círculo Numerado + Línea Vertical Conectora */}
                          <div className="flex flex-col items-center shrink-0">
                            <div
                              style={{ animationDelay: `${delayBadge}ms` }}
                              className={`animate-nolan-pop h-7 w-7 rounded-full flex items-center justify-center text-xs font-extrabold shadow-md ${badgeColorClass}`}
                            >
                              {ev.numero}
                            </div>

                            {!esUltimo && (
                              <div
                                style={{ animationDelay: `${delayConnector}ms` }}
                                className="animate-nolan-connector flex flex-col items-center my-1"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 mb-1" />
                                <div className="w-[1.5px] h-8 bg-zinc-200" />
                              </div>
                            )}
                          </div>

                          {/* Columna Central: Hora, Acción y Píldoras de Estado */}
                          <div
                            style={{ animationDelay: `${delayContent}ms` }}
                            className={`animate-nolan-stagger flex-1 min-w-0 ${
                              esUltimo ? "pb-2" : "pb-4"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-sm font-black text-zinc-900 font-mono tracking-tight">
                                    {ev.hora}
                                  </span>
                                  <span className="text-xs font-bold text-zinc-700">
                                    {verboEvento}
                                  </span>
                                </div>

                                {/* Píldoras de Estado (Retardo, Zona GPS y Face ID) */}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  {ev.esRetardo && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-bold">
                                      Llegaste {ev.minutosRetardo} min tarde
                                    </span>
                                  )}

                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                      ev.enGeocerca
                                        ? "bg-emerald-50/90 text-emerald-800 border-emerald-200/70"
                                        : "bg-amber-50 text-amber-800 border-amber-200"
                                    }`}
                                  >
                                    <MapPin className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                                    {ev.enGeocerca
                                      ? "Dentro de tu zona"
                                      : `Fuera de zona (${ev.distanciaMetros}m)`}
                                  </span>

                                  {ev.validacionIdentidad === "FACE_ID_BIOMETRICO_VERIFICADO" && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200 text-[9px] font-semibold">
                                      <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />
                                      Face ID {ev.similitudFacial || 92}%
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Botón derecho de Evidencia / Cámara (como el icono derecho en el video) */}
                              <div className="flex items-center gap-1 shrink-0">
                                {ev.fotoUrl ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFotoModal({
                                        url: ev.fotoUrl!,
                                        titulo: `${ev.tipo} — ${ev.hora}`,
                                        hora: ev.horaConSegundos || ev.hora,
                                        lugar:
                                          ev.lugarAutorizado ||
                                          datos.configuracionTaller.nombreTaller,
                                        similitudFacial: ev.similitudFacial,
                                        validacion: ev.validacionIdentidad,
                                      })
                                    }
                                    title="Ver evidencia fotográfica y firma biométrica"
                                    className="h-8 w-8 rounded-xl bg-zinc-100 hover:bg-zinc-900 text-zinc-700 hover:text-white border border-zinc-200/80 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                  >
                                    <Camera className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <div
                                    title={
                                      ev.metodoRegistro === "WEB"
                                        ? "Marcaje Web GPS"
                                        : "Checador ZKTeco"
                                    }
                                    className="h-7 w-7 rounded-xl bg-zinc-50 text-zinc-400 border border-zinc-200/60 flex items-center justify-center"
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 5. Pie Fijo del Panel ("TU HORARIO" | "TOLERANCIA") idéntico al video */}
            <div className="border-t border-zinc-200/80 bg-[#FAF9F6] px-5 py-3.5 grid grid-cols-2 divide-x divide-zinc-200/80 shrink-0 pb-safe">
              <div className="pr-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 block">
                  TU HORARIO
                </span>
                <span className="text-xs font-extrabold text-zinc-900 font-mono block mt-0.5">
                  {regimenDiaSeleccionado.horarioTexto}
                </span>
              </div>

              <div className="pl-4">
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 block">
                  TOLERANCIA
                </span>
                <span className="text-xs font-extrabold text-zinc-900 font-mono block mt-0.5">
                  {regimenDiaSeleccionado.toleranciaTexto}
                </span>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* =========================================================================
          3. MODAL DE EVIDENCIA FOTOGRÁFICA Y AUDITORÍA FORENSE
         ========================================================================= */}
      {fotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setFotoModal(null)}
        >
          <div
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl border border-zinc-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">
                    Evidencia Biométrica de Asistencia
                  </h4>
                  <p className="text-[10px] text-zinc-400">
                    Certificación de Identidad — {fotoModal.titulo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFotoModal(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Imagen de Alta Fidelidad */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-200 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotoModal.url}
                alt="Selfie de asistencia"
                className="w-full h-full object-cover"
              />
              {/* Marca de Agua Forense */}
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-[10px] space-y-0.5">
                <p className="font-bold">{datos.empleadoSeleccionado.nombreCompleto}</p>
                <p className="text-zinc-300 font-mono">
                  {diaSeleccionado?.fecha} • {fotoModal.hora} hrs
                </p>
                <p className="text-emerald-300">{fotoModal.lugar}</p>
              </div>
            </div>

            {/* Ficha Técnica de Validación */}
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">Validación de Identidad:</span>
                <span className="font-bold text-zinc-900">
                  {fotoModal.validacion === "FACE_ID_BIOMETRICO_VERIFICADO"
                    ? "Face ID Biométrico 1:1"
                    : "PIN + GPS Verificado"}
                </span>
              </div>
              {fotoModal.similitudFacial && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-medium">Similitud Biométrica:</span>
                  <span className="font-bold text-emerald-700">
                    {fotoModal.similitudFacial}% (Aprobado LFT)
                  </span>
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={() => setFotoModal(null)}
              className="w-full rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cerrar Expediente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
