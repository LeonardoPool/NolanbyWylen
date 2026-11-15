"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Radio,
  Clock,
  ShieldCheck,
  Coffee,
  Plane,
  RefreshCw,
  Camera,
  MapPin,
  Cpu,
  Edit3,
  TrendingUp,
  X,
  CheckCircle2,
  AlertCircle,
  Activity,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/feedback/toast";
import { createClient } from "@/lib/supabase/client";
import {
  obtenerMetricasDashboard,
  type MetricasDashboard,
} from "../actions";

interface DashboardVistaProps {
  metricasIniciales: MetricasDashboard;
}

export function DashboardVista({ metricasIniciales }: DashboardVistaProps) {
  const [metricas, setMetricas] = useState<MetricasDashboard>(metricasIniciales);
  const [isPendingRefresh, startRefreshTransition] = useTransition();
  const [ultimoRefresco, setUltimoRefresco] = useState<Date>(new Date());
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [fotoModalUrl, setFotoModalUrl] = useState<string | null>(null);

  const supabase = React.useMemo(() => createClient(), []);

  // Función para refrescar las métricas desde el servidor
  const recargarMetricas = React.useCallback((mostrarToast = false) => {
    startRefreshTransition(async () => {
      const res = await obtenerMetricasDashboard();
      if (res.success && res.metricas) {
        setMetricas(res.metricas);
        setUltimoRefresco(new Date());
        if (mostrarToast) {
          notify.success("Datos actualizados", "Métricas sincronizadas en tiempo real.");
        }
      }
    });
  }, []);

  // Suscripción en Tiempo Real con Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel("dashboard_asistencias_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "asistencias",
        },
        (payload) => {
          // Marcaje entrante en tiempo real
          notify.info(
            "Nuevo marcaje detectado",
            `Se recibió un evento de asistencia (${payload.new.tipo_evento_original}). Actualizando tablero...`
          );
          recargarMetricas(false);
        }
      )
      .subscribe();

    // Sondeo de respaldo cada 30 segundos
    const pollInterval = setInterval(() => {
      recargarMetricas(false);
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [supabase, recargarMetricas]);

  const { resumenPersonal, distribucionPersonal, tendenciaSemanal, ultimosMarcajes, configuracionTaller } = metricas;

  // Formateador de tiempo relativo
  function calcularTiempoRelativo(isoStr: string) {
    const ahora = new Date().getTime();
    const pasado = new Date(isoStr).getTime();
    const diffMin = Math.floor((ahora - pasado) / (1000 * 60));

    if (diffMin < 1) return "Hace unos segundos";
    if (diffMin === 1) return "Hace 1 minuto";
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHoras = Math.floor(diffMin / 60);
    if (diffHoras === 1) return "Hace 1 hora";
    if (diffHoras < 24) return `Hace ${diffHoras} horas`;
    return new Date(isoStr).toLocaleDateString("es-MX", { month: "short", day: "numeric" });
  }

  // Cálculos para la gráfica Donut SVG
  const totalDonut = resumenPersonal.totalActivos || 1;
  const radioDonut = 48;
  const circunferencia = 2 * Math.PI * radioDonut; // ~301.59
  let acumuladorPorcentaje = 0;

  // Máximo para escalar las barras de la gráfica semanal
  const maxBarra = Math.max(
    ...tendenciaSemanal.map((d) => d.aTiempo + d.retardos + d.ausentes),
    resumenPersonal.totalActivos || 1
  );

  return (
    <div className="space-y-6">
      {/* Header con Estado en Vivo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            Resumen Operativo
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </h1>
          <p className="text-xs text-zinc-500">
            Control de asistencia y estado del personal en <strong>{configuracionTaller.nombreTaller}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-zinc-600 bg-white shadow-2xs gap-1.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium">En vivo (Tiempo Real)</span>
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => recargarMetricas(true)}
            disabled={isPendingRefresh}
            className="rounded-xl text-xs h-8 px-2.5 shadow-2xs text-zinc-700 hover:text-zinc-900"
            title="Refrescar métricas ahora"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPendingRefresh ? "animate-spin text-blue-600" : "text-zinc-400"}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Personal Activo */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs hover:border-zinc-300 transition-colors p-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-semibold text-zinc-500">Personal Activo</span>
            <Users className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
          </div>
          <div className="text-2xl font-black text-zinc-900 tracking-tight mt-1">
            {resumenPersonal.totalActivos}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">Mecánicos y operadores registrados</p>
        </Card>

        {/* Presentes Hoy en Taller */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs hover:border-zinc-300 transition-colors p-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-semibold text-emerald-700">Presentes en Taller</span>
            <UserCheck className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
          </div>
          <div className="text-2xl font-black text-emerald-950 tracking-tight mt-1">
            {resumenPersonal.presentesHoy}
          </div>
          <p className="text-[11px] text-emerald-700/80 mt-0.5">Laborando actualmente en sede</p>
        </Card>

        {/* En Descanso / Comida */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs hover:border-zinc-300 transition-colors p-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-semibold text-amber-700">En Descanso / Comida</span>
            <Coffee className="h-4 w-4 text-amber-600" strokeWidth={1.5} />
          </div>
          <div className="text-2xl font-black text-amber-950 tracking-tight mt-1">
            {resumenPersonal.enDescansoHoy}
          </div>
          <p className="text-[11px] text-amber-700/80 mt-0.5">Pausa laboral en curso</p>
        </Card>

        {/* Sin Marcaje / Ausentes Hoy */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs hover:border-zinc-300 transition-colors p-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-semibold text-zinc-600">Sin Checar Hoy</span>
            <UserX className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
          </div>
          <div className="text-2xl font-black text-zinc-900 tracking-tight mt-1">
            {resumenPersonal.sinMarcajeHoy}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {resumenPersonal.enViajeHoy > 0
              ? `${resumenPersonal.enViajeHoy} con permiso de viaje activo`
              : "Pendientes de entrada"}
          </p>
        </Card>
      </div>

      {/* SECCIÓN DE GRÁFICAS OPERATIVAS INTERACTIVAS */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* GRÁFICA 1: Tendencia Semanal de Asistencia (Barras Apiladas SVG con Tooltip Interactivo) */}
        <Card className="lg:col-span-4 rounded-3xl border-zinc-200/90 shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Asistencia Semanal y Puntualidad
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Desglose diario de entradas a tiempo, retardos y ausencias (últimos 7 días).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  A tiempo
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Retardo
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-zinc-200" />
                  Ausente
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-3">
            {/* Gráfica de Barras SVG Nativa */}
            <div className="relative h-56 w-full flex items-end justify-between gap-2 pt-6 pb-6">
              {tendenciaSemanal.map((dia, idx) => {
                const total = dia.aTiempo + dia.retardos + dia.ausentes || 1;
                const alturaMaxPx = 150;

                const alturaATiempo = Math.round((dia.aTiempo / maxBarra) * alturaMaxPx);
                const alturaRetardos = Math.round((dia.retardos / maxBarra) * alturaMaxPx);
                const alturaAusentes = Math.max(4, Math.round((dia.ausentes / maxBarra) * alturaMaxPx));

                const isHovered = hoveredBar === idx;

                return (
                  <div
                    key={dia.fecha}
                    className="relative flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                    onMouseEnter={() => setHoveredBar(idx)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip flotante al pasar el mouse */}
                    {isHovered && (
                      <div className="absolute bottom-full mb-2 z-30 bg-zinc-950 text-white p-2.5 rounded-xl shadow-xl text-[10px] w-36 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
                        <p className="font-bold border-b border-zinc-800 pb-1 mb-1 text-zinc-200">
                          {dia.diaNombre} ({dia.fecha})
                        </p>
                        <div className="space-y-0.5">
                          <p className="flex justify-between text-emerald-400">
                            <span>A tiempo:</span> <strong>{dia.aTiempo}</strong>
                          </p>
                          <p className="flex justify-between text-amber-400">
                            <span>Retardos:</span> <strong>{dia.retardos}</strong>
                          </p>
                          <p className="flex justify-between text-zinc-400">
                            <span>Ausentes:</span> <strong>{dia.ausentes}</strong>
                          </p>
                          <p className="flex justify-between text-blue-300 pt-0.5 border-t border-zinc-800">
                            <span>Horas estimadas:</span> <strong>{dia.horasTotales}h</strong>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Barra Apilada Segmentada */}
                    <div className="w-full max-w-[38px] flex flex-col items-center justify-end rounded-t-xl overflow-hidden shadow-2xs transition-transform duration-150 group-hover:scale-y-105 origin-bottom">
                      {/* Segmento Ausentes */}
                      <div
                        style={{ height: `${alturaAusentes}px` }}
                        className="w-full bg-zinc-200/90 transition-all"
                      />
                      {/* Segmento Retardos */}
                      {dia.retardos > 0 && (
                        <div
                          style={{ height: `${alturaRetardos}px` }}
                          className="w-full bg-amber-500 transition-all"
                        />
                      )}
                      {/* Segmento A Tiempo */}
                      <div
                        style={{ height: `${alturaATiempo}px` }}
                        className="w-full bg-emerald-500 transition-all"
                      />
                    </div>

                    {/* Etiqueta del Día */}
                    <div className="mt-2 text-center">
                      <span className={`text-[11px] font-semibold block ${isHovered ? "text-blue-600" : "text-zinc-700"}`}>
                        {dia.diaNombre}
                      </span>
                      <span className="text-[9px] text-zinc-400 block">
                        {dia.fecha.slice(8)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Tasa de puntualidad general: <strong>{resumenPersonal.tasaPuntualidad}%</strong></span>
              <span>Puntualidad hoy: <strong>{metricas.metricasHorasHoy.retardosHoy === 0 ? "100% a tiempo" : `${metricas.metricasHorasHoy.retardosHoy} retardos`}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* GRÁFICA 2: Distribución de Personal en Vivo (Donut Chart SVG) */}
        <Card className="lg:col-span-3 rounded-3xl border-zinc-200/90 shadow-sm flex flex-col">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-600" />
              Distribución de Personal en Vivo
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Estado de cada trabajador en este instante.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-3 flex-1 flex flex-col justify-between">
            {/* Gráfica Circular Donut SVG */}
            <div className="relative w-44 h-44 mx-auto my-1 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                {/* Círculo base gris */}
                <circle
                  cx="60"
                  cy="60"
                  r={radioDonut}
                  fill="transparent"
                  stroke="#F4F4F5"
                  strokeWidth="14"
                />

                {/* Arcos coloreados según distribución */}
                {distribucionPersonal.map((segmento, i) => {
                  const longitudSegmento = (segmento.porcentaje / 100) * circunferencia;
                  const dashOffset = -((acumuladorPorcentaje / 100) * circunferencia);
                  acumuladorPorcentaje += segmento.porcentaje;

                  if (segmento.cantidad === 0) return null;

                  return (
                    <circle
                      key={segmento.etiqueta}
                      cx="60"
                      cy="60"
                      r={radioDonut}
                      fill="transparent"
                      stroke={segmento.color}
                      strokeWidth="14"
                      strokeDasharray={`${longitudSegmento} ${circunferencia - longitudSegmento}`}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  );
                })}
              </svg>

              {/* Centro del Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-zinc-900 leading-none">
                  {resumenPersonal.totalActivos}
                </span>
                <span className="text-[10px] font-medium text-zinc-500 mt-1 uppercase tracking-wider">
                  Total
                </span>
              </div>
            </div>

            {/* Leyenda interactiva */}
            <div className="space-y-1.5 pt-3 border-t border-zinc-100 text-xs">
              {distribucionPersonal.map((item) => (
                <div key={item.etiqueta} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-zinc-700 font-medium">{item.etiqueta}</span>
                  </span>
                  <span className="font-semibold text-zinc-900 font-mono">
                    {item.cantidad} ({item.porcentaje}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN: MONITOR EN VIVO DE ACTIVIDAD Y CANAL DE INFRAESTRUCTURA */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Feed de Actividad Reciente en Vivo */}
        <Card className="md:col-span-4 rounded-3xl border-zinc-200/90 shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-3 bg-zinc-50/50 border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Actividad Reciente en Tiempo Real
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Últimos marcajes sincronizados desde el checador web o hardware físico.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] bg-white border-zinc-200">
                {ultimosMarcajes.length} eventos
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ultimosMarcajes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="h-8 w-8 text-zinc-300 mb-2" />
                <p className="text-xs font-semibold text-zinc-700">Sin marcajes registrados el día de hoy</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 max-w-xs">
                  Los eventos de entrada, comida y salida aparecerán aquí en vivo al checar en el celular o biométrico.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
                {ultimosMarcajes.map((ev) => {
                  const nombresEventos: Record<string, { label: string; badgeClass: string }> = {
                    ENTRADA: { label: "Entrada", badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                    INICIO_DESCANSO: { label: "Salida a Comida", badgeClass: "bg-amber-50 text-amber-800 border-amber-200" },
                    FIN_DESCANSO: { label: "Regreso Comida", badgeClass: "bg-blue-50 text-blue-800 border-blue-200" },
                    SALIDA: { label: "Salida Final", badgeClass: "bg-zinc-100 text-zinc-800 border-zinc-300" },
                  };
                  const metaEvento = nombresEventos[ev.tipoEvento] || {
                    label: ev.tipoEvento,
                    badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200",
                  };

                  return (
                    <div
                      key={ev.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Miniatura de Foto / Avatar */}
                        {ev.fotoUrl ? (
                          <button
                            type="button"
                            onClick={() => setFotoModalUrl(ev.fotoUrl)}
                            className="relative h-9 w-9 rounded-full overflow-hidden border-2 border-blue-500 shrink-0 shadow-2xs hover:scale-105 transition-transform"
                            title="Ver selfie de validación"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ev.fotoUrl} alt="Selfie" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 font-bold text-xs shrink-0">
                            {ev.nombreCompleto.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-zinc-900 text-xs truncate">
                              {ev.nombreCompleto}
                            </p>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${metaEvento.badgeClass}`}>
                              {metaEvento.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                            {ev.numeroEmpleado} • {ev.puesto}
                            {ev.lugarNombre && ` • ${ev.lugarNombre}`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-bold text-zinc-800 block">
                          {new Date(ev.fechaHora).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-[9px] text-zinc-400 block mt-0.5">
                          {calcularTiempoRelativo(ev.fechaHora)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estado de Sincronización y Canales de Hardware */}
        <Card className="md:col-span-3 rounded-3xl border-zinc-200/90 shadow-sm flex flex-col justify-between">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
              <Radio className="h-4 w-4 text-emerald-600" />
              Canales de Acceso y Sincronización
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Estado del checador web móvil y hardware biométrico.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-3.5">
            {/* Checador Web Móvil */}
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  Checador Web Móvil (GPS)
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  configuracionTaller.checadoWebHabilitado
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}>
                  {configuracionTaller.checadoWebHabilitado ? "Habilitado" : "Deshabilitado"}
                </span>
              </div>
              <div className="text-[11px] text-zinc-600 space-y-1">
                <p>Geocerca: <strong>{configuracionTaller.radioTolerancia}m</strong> de radio autorizado.</p>
                <p className="text-[10px] text-zinc-400 truncate">
                  Sede: {configuracionTaller.direccion || "Av. Principal del Taller"}
                </p>
              </div>
            </div>

            {/* Checador Biométrico Físico */}
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-emerald-600" />
                  Checador ZKTeco MB10V
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  En Línea
                </span>
              </div>
              <p className="text-[11px] text-zinc-600">
                Sincronización directa vía TCP/IP e integración cloud inmutable.
              </p>
            </div>

            {/* Certificado de Integridad y LFT */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-[11px] text-emerald-900 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Base de Datos Auditada con LFT</p>
                <p className="text-[10px] text-emerald-800 leading-relaxed mt-0.5">
                  Los registros cuentan con sellos criptográficos SHA-256 e inmutabilidad garantizada.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Vista Previa de Selfie Facial */}
      {fotoModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 shadow-2xl text-center space-y-3 border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-blue-600" />
                Validación Facial en Vivo
              </span>
              <button
                type="button"
                onClick={() => setFotoModalUrl(null)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-blue-600 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoModalUrl} alt="Selfie de asistencia" className="w-full h-full object-cover" />
            </div>

            <p className="text-[10px] text-zinc-500">
              Capturada durante el checado en tiempo real para garantizar identidad inequívoca.
            </p>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setFotoModalUrl(null)}
              className="w-full rounded-xl text-xs"
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
