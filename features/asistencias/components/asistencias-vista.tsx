"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  Clock,
  Calendar,
  Download,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Loader2,
  Camera,
  MapPin,
  Cpu,
  Edit3,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { notify } from "@/lib/feedback/toast";
import {
  obtenerAsistenciasPeriodo,
  registrarMarcajeManual,
  type JornadaEmpleadoCompleta,
  type ResumenSemanalLFT,
} from "../actions";
import type { EmpleadoRow } from "@/features/empleados/actions";

interface AsistenciasVistaProps {
  jornadasIniciales: JornadaEmpleadoCompleta[];
  resumenInicial: ResumenSemanalLFT;
  empleados: EmpleadoRow[];
  fechaInicioDefault: string;
  fechaFinDefault: string;
}

export function AsistenciasVista({
  jornadasIniciales,
  resumenInicial,
  empleados,
  fechaInicioDefault,
  fechaFinDefault,
}: AsistenciasVistaProps) {
  const [jornadas, setJornadas] = useState<JornadaEmpleadoCompleta[]>(jornadasIniciales);
  const [resumen, setResumen] = useState<ResumenSemanalLFT>(resumenInicial);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState(fechaInicioDefault);
  const [fechaFin, setFechaFin] = useState(fechaFinDefault);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState("todos");
  const [busquedaTexto, setBusquedaTexto] = useState("");
  const [filtroRapido, setFiltroRapido] = useState<"hoy" | "semana" | "quincena" | "mes" | "custom">("quincena");

  const [isPendingFilter, startFilterTransition] = useTransition();

  // Modal Marcaje Manual
  const [modalManual, setModalManual] = useState(false);
  const [isPendingManual, startManualTransition] = useTransition();
  const [manualEmpId, setManualEmpId] = useState(empleados[0]?.id || "");
  const [manualFecha, setManualFecha] = useState(new Date().toISOString().slice(0, 10));
  const [manualHora, setManualHora] = useState("09:00");
  const [manualTipo, setManualTipo] = useState<"ENTRADA" | "INICIO_DESCANSO" | "FIN_DESCANSO" | "SALIDA">("ENTRADA");
  const [manualMotivo, setManualMotivo] = useState("");

  // Modal Foto / Selfie Preview
  const [fotoModalUrl, setFotoModalUrl] = useState<string | null>(null);

  // Aplicar filtros de fecha rápidos
  function aplicarRangoRapido(tipo: "hoy" | "semana" | "quincena" | "mes") {
    setFiltroRapido(tipo);
    const ahora = new Date();
    let inicio = new Date(ahora);
    let fin = new Date(ahora);

    if (tipo === "hoy") {
      // inicio = fin = hoy
    } else if (tipo === "semana") {
      const diaSemana = ahora.getDay() || 7; // Lunes = 1
      inicio.setDate(ahora.getDate() - diaSemana + 1);
    } else if (tipo === "quincena") {
      const dia = ahora.getDate();
      if (dia <= 15) {
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        fin = new Date(ahora.getFullYear(), ahora.getMonth(), 15);
      } else {
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 16);
        fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
      }
    } else if (tipo === "mes") {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
    }

    const iniStr = inicio.toISOString().slice(0, 10);
    const finStr = fin.toISOString().slice(0, 10);
    setFechaInicio(iniStr);
    setFechaFin(finStr);
    ejecutarConsulta(iniStr, finStr, empleadoSeleccionado);
  }

  function ejecutarConsulta(ini: string, fin: string, empId: string) {
    startFilterTransition(async () => {
      const res = await obtenerAsistenciasPeriodo({
        fechaInicio: ini,
        fechaFin: fin,
        empleadoId: empId,
      });

      if (res.success) {
        setJornadas(res.jornadas);
        setResumen(res.resumen);
      } else {
        notify.error("Error al consultar", res.error);
      }
    });
  }

  async function handleGuardarMarcajeManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualMotivo || manualMotivo.trim().length < 5) {
      notify.warning("Motivo obligatorio", "La normativa LFT exige especificar el motivo de la corrección manual.");
      return;
    }

    const formData = new FormData();
    formData.append("empleado_id", manualEmpId);
    formData.append("fecha", manualFecha);
    formData.append("hora", manualHora);
    formData.append("tipo_evento", manualTipo);
    formData.append("motivo_ajuste", manualMotivo.trim());

    startManualTransition(async () => {
      const res = await registrarMarcajeManual(formData);
      if (!res.success) {
        notify.error("Error al registrar", res.error);
        return;
      }

      notify.success("Marcaje Registrado", res.message);
      setModalManual(false);
      setManualMotivo("");
      ejecutarConsulta(fechaInicio, fechaFin, empleadoSeleccionado);
    });
  }

  // Filtrado local por texto de búsqueda
  const jornadasFiltradas = jornadas.filter((j) => {
    if (!busquedaTexto.trim()) return true;
    const q = busquedaTexto.toLowerCase();
    const nombreCompleto = `${j.empleado.nombre} ${j.empleado.apellidos}`.toLowerCase();
    return (
      nombreCompleto.includes(q) ||
      j.empleado.numero_empleado.toLowerCase().includes(q) ||
      j.empleado.puesto.toLowerCase().includes(q)
    );
  });

  function formatearHora(isoStr?: string | null) {
    if (!isoStr) return "--:--";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function renderBadgeMetodo(ev: any) {
    if (!ev) return null;
    const m = ev.metodoRegistro;
    if (m === "WEB") {
      return (
        <span
          title="Checado móvil vía GPS"
          className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
        >
          <MapPin className="h-2.5 w-2.5 text-blue-600" />
          WEB
        </span>
      );
    }
    if (m === "DISPOSITIVO") {
      return (
        <span
          title="Checador biométrico de huella"
          className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
        >
          <Cpu className="h-2.5 w-2.5 text-emerald-600" />
          HUELLA
        </span>
      );
    }
    return (
      <span
        title={`Marcaje manual auditado: ${ev.motivoAjuste || "Sin motivo"}`}
        className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
      >
        <Edit3 className="h-2.5 w-2.5 text-amber-600" />
        MANUAL
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            Control de Asistencias (LFT Art. 132 fr. XXXIV)
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </h1>
          <p className="text-xs text-zinc-500">
            Registro cronológico inmutable de las 4 marcas diarias con cálculo automático de horas extras conforme a la ley.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setModalManual(true)}
            className="rounded-xl text-xs bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1" strokeWidth={2} />
            Marcaje Manual / Ajuste
          </Button>
        </div>
      </div>

      {/* Métricas de Resumen LFT */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="rounded-2xl border-zinc-200 bg-white shadow-2xs p-3">
          <p className="text-[11px] font-medium text-zinc-500">Días Laborados</p>
          <p className="text-xl font-bold text-zinc-900 mt-1">{resumen.diasLaborados}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Jornadas registradas</p>
        </Card>

        <Card className="rounded-2xl border-zinc-200 bg-white shadow-2xs p-3">
          <p className="text-[11px] font-medium text-zinc-500">Horas Ordinarias</p>
          <p className="text-xl font-bold text-blue-950 mt-1">{resumen.horasOrdinariasTotales} hrs</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Base 100% (LFT Art. 61)</p>
        </Card>

        <Card className="rounded-2xl border-zinc-200 bg-white shadow-2xs p-3">
          <p className="text-[11px] font-medium text-amber-700">Horas Extras Dobles</p>
          <p className="text-xl font-bold text-amber-900 mt-1">{resumen.horasExtraDoblesTotales} hrs</p>
          <p className="text-[10px] text-amber-600 mt-0.5">Pago al 200% (Tope 9h/sem)</p>
        </Card>

        <Card className="rounded-2xl border-zinc-200 bg-white shadow-2xs p-3">
          <p className="text-[11px] font-medium text-rose-700">Horas Extras Triples</p>
          <p className="text-xl font-bold text-rose-900 mt-1">{resumen.horasExtraTriplesTotales} hrs</p>
          <p className="text-[10px] text-rose-600 mt-0.5">Pago al 300% (Excedentes)</p>
        </Card>

        <Card className="rounded-2xl border-zinc-200 bg-white shadow-2xs p-3">
          <p className="text-[11px] font-medium text-zinc-500">Retardos Detectados</p>
          <p className="text-xl font-bold text-zinc-900 mt-1">{resumen.totalRetardos}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">&gt; 15 min de tolerancia</p>
        </Card>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <Card className="rounded-2xl border-zinc-200 shadow-2xs">
        <CardContent className="p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Botones de Rango Rápido */}
            <div className="flex items-center gap-1 bg-zinc-100/90 p-1 rounded-xl border border-zinc-200/60 text-xs">
              <button
                type="button"
                onClick={() => aplicarRangoRapido("hoy")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filtroRapido === "hoy" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => aplicarRangoRapido("semana")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filtroRapido === "semana" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Esta semana
              </button>
              <button
                type="button"
                onClick={() => aplicarRangoRapido("quincena")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filtroRapido === "quincena" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Quincena actual
              </button>
              <button
                type="button"
                onClick={() => aplicarRangoRapido("mes")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filtroRapido === "mes" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Mes actual
              </button>
            </div>

            {/* Fechas Manuales */}
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setFiltroRapido("custom");
                }}
                className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-900"
              />
              <span className="text-zinc-400">al</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => {
                  setFechaFin(e.target.value);
                  setFiltroRapido("custom");
                }}
                className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-900"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => ejecutarConsulta(fechaInicio, fechaFin, empleadoSeleccionado)}
                disabled={isPendingFilter}
                className="rounded-xl h-7 px-3 text-xs"
              >
                {isPendingFilter ? <Loader2 className="h-3 w-3 animate-spin" /> : "Filtrar"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-zinc-100">
            {/* Buscador de texto */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={busquedaTexto}
                onChange={(e) => setBusquedaTexto(e.target.value)}
                placeholder="Buscar por nombre, mecánico o clave de empleado..."
                className="w-full rounded-xl border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
              />
            </div>

            {/* Selector de empleado */}
            <select
              value={empleadoSeleccionado}
              onChange={(e) => {
                setEmpleadoSeleccionado(e.target.value);
                ejecutarConsulta(fechaInicio, fechaFin, e.target.value);
              }}
              className="w-full sm:w-64 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
            >
              <option value="todos">Todos los empleados</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.numero_empleado} — {emp.nombre} {emp.apellidos}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla Principal de Marcajes Diarios (4 marcas LFT) */}
      <Card className="rounded-2xl border-zinc-200 overflow-hidden shadow-2xs">
        <CardHeader className="bg-zinc-50/60 border-b border-zinc-200/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-zinc-900">
                Jornadas Diarias Registradas ({jornadasFiltradas.length})
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                1. Entrada • 2. Salida a comida • 3. Regreso de comida • 4. Salida final
              </CardDescription>
            </div>
            {isPendingFilter && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Actualizando...
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jornadasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-xs font-semibold text-zinc-700">No se encontraron jornadas para este rango</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Los marcajes realizados en la app o en el checador físico aparecerán asentados aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100/60 text-zinc-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Empleado</th>
                    <th className="py-2.5 px-3">1. Entrada</th>
                    <th className="py-2.5 px-3">2. Salida Comida</th>
                    <th className="py-2.5 px-3">3. Regreso Comida</th>
                    <th className="py-2.5 px-3">4. Salida Final</th>
                    <th className="py-2.5 px-3 text-right">Efectivas</th>
                    <th className="py-2.5 px-3 text-right">Ext. Dobles</th>
                    <th className="py-2.5 px-3 text-right">Ext. Triples</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-center">Evidencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {jornadasFiltradas.map((j, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-3 font-medium text-zinc-900 whitespace-nowrap">
                        {j.fecha}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-zinc-900 leading-tight">
                          {j.empleado.nombre} {j.empleado.apellidos}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {j.empleado.numero_empleado} • {j.empleado.puesto}
                        </div>
                      </td>

                      {/* 1. Entrada */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-zinc-800">
                          {formatearHora(j.entrada?.fechaHora)}
                        </div>
                        {j.entrada && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {renderBadgeMetodo(j.entrada)}
                            {j.esRetardo && (
                              <span className="text-[9px] text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                                +{j.minutosRetardo}m
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 2. Salida Comida */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-zinc-700">{formatearHora(j.inicioDescanso?.fechaHora)}</div>
                        {j.inicioDescanso && (
                          <div className="mt-0.5">{renderBadgeMetodo(j.inicioDescanso)}</div>
                        )}
                      </td>

                      {/* 3. Regreso Comida */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-zinc-700">{formatearHora(j.finDescanso?.fechaHora)}</div>
                        {j.finDescanso && (
                          <div className="mt-0.5">{renderBadgeMetodo(j.finDescanso)}</div>
                        )}
                      </td>

                      {/* 4. Salida Final */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-zinc-800">
                          {formatearHora(j.salida?.fechaHora)}
                        </div>
                        {j.salida && (
                          <div className="mt-0.5">{renderBadgeMetodo(j.salida)}</div>
                        )}
                      </td>

                      {/* Horas Efectivas */}
                      <td className="py-3 px-3 text-right font-bold text-blue-950">
                        {j.horasOrdinarias}h
                      </td>

                      {/* Horas Dobles */}
                      <td className="py-3 px-3 text-right font-semibold text-amber-800">
                        {j.horasExtraDobles > 0 ? `+${j.horasExtraDobles}h` : "—"}
                      </td>

                      {/* Horas Triples */}
                      <td className="py-3 px-3 text-right font-semibold text-rose-800">
                        {j.horasExtraTriples > 0 ? `+${j.horasExtraTriples}h` : "—"}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {j.estadoJornada === "COMPLETA" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Completa
                          </span>
                        )}
                        {j.estadoJornada === "EN_CURSO" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            <Clock className="h-3 w-3" />
                            En curso
                          </span>
                        )}
                        {j.estadoJornada === "INCOMPLETA" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <AlertCircle className="h-3 w-3" />
                            Incompleta
                          </span>
                        )}
                      </td>

                      {/* Evidencia Fotográfica */}
                      <td className="py-3 px-3 text-center">
                        {j.entrada?.fotoUrl || j.salida?.fotoUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFotoModalUrl(j.entrada?.fotoUrl || j.salida?.fotoUrl || null)}
                            className="h-6 px-2 text-[10px] rounded-lg text-blue-700 border-blue-200 hover:bg-blue-50"
                          >
                            <Camera className="h-3 w-3 mr-1" />
                            Ver foto
                          </Button>
                        ) : (
                          <span className="text-zinc-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Marcaje Manual (Trazabilidad LFT) */}
      {modalManual && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                  <Edit3 className="h-4 w-4 text-blue-600" />
                  Marcaje Manual / Corrección Auditada
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Cumplimiento del Pilar de Trazabilidad: Motivo, fecha y autor inalterables.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalManual(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarMarcajeManual} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 block">Empleado</label>
                <select
                  value={manualEmpId}
                  onChange={(e) => setManualEmpId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                >
                  {empleados.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.numero_empleado} — {emp.nombre} {emp.apellidos} ({emp.puesto})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-700 block">Fecha</label>
                  <input
                    type="date"
                    required
                    value={manualFecha}
                    onChange={(e) => setManualFecha(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-700 block">Hora</label>
                  <input
                    type="time"
                    required
                    value={manualHora}
                    onChange={(e) => setManualHora(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 block">Tipo de Evento</label>
                <select
                  value={manualTipo}
                  onChange={(e) => setManualTipo(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                >
                  <option value="ENTRADA">1. Entrada de jornada</option>
                  <option value="INICIO_DESCANSO">2. Salida a comida / descanso</option>
                  <option value="FIN_DESCANSO">3. Regreso de comida / descanso</option>
                  <option value="SALIDA">4. Salida definitiva</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 flex items-center justify-between">
                  <span>Motivo Justificado (Obligatorio por Ley)</span>
                  <span className="text-[10px] text-amber-700 font-normal">Auditado</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={manualMotivo}
                  onChange={(e) => setManualMotivo(e.target.value)}
                  placeholder="Ej. Falla eléctrica en checador físico autorizada por el encargado..."
                  className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalManual(false)}
                  disabled={isPendingManual}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPendingManual}
                  className="rounded-xl text-xs bg-zinc-900 text-white"
                >
                  {isPendingManual ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : "Guardar Registro"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview Foto / Selfie */}
      {fotoModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 shadow-2xl text-center space-y-3 border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-blue-600" />
                Evidencia Fotográfica
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
              <img
                src={fotoModalUrl}
                alt="Selfie de asistencia"
                className="w-full h-full object-cover"
              />
            </div>

            <p className="text-[10px] text-zinc-500">
              Capturada en el dispositivo móvil durante el checado para garantizar identidad inequívoca.
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
