"use client";

import * as React from "react";
import { useState, useTransition, useMemo } from "react";
import {
  ScrollText,
  Search,
  Filter,
  UserCheck,
  Clock,
  MapPin,
  CalendarCheck,
  FileCheck2,
  AlertCircle,
  Eye,
  X,
  ChevronRight,
  Download,
  ShieldCheck,
  RefreshCw,
  Calendar,
  Layers,
  ArrowUpRight,
  Building2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { notify } from "@/lib/feedback/toast";
import {
  obtenerBitacoraEventos,
  type RegistroBitacoraItem,
  type MetricasBitacora,
  type CategoriaBitacora,
} from "../actions";

interface BitacoraVistaProps {
  registrosIniciales: RegistroBitacoraItem[];
  metricasIniciales: MetricasBitacora;
}

export function BitacoraVista({
  registrosIniciales,
  metricasIniciales,
}: BitacoraVistaProps) {
  const [registros, setRegistros] = useState<RegistroBitacoraItem[]>(registrosIniciales);
  const [metricas, setMetricas] = useState<MetricasBitacora>(metricasIniciales);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<CategoriaBitacora>("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [rangoDias, setRangoDias] = useState<number>(30);
  const [isPending, startTransition] = useTransition();

  // Modal de Detalle
  const [registroDetalle, setRegistroDetalle] = useState<RegistroBitacoraItem | null>(null);

  // Recargar datos
  const refrescarDatos = (cat: CategoriaBitacora = categoriaSeleccionada, dias = rangoDias, q = busqueda) => {
    startTransition(async () => {
      const res = await obtenerBitacoraEventos({
        categoria: cat,
        rangoDias: dias,
        busqueda: q,
      });

      if (res.success) {
        setRegistros(res.registros);
        setMetricas(res.metricas);
      } else {
        notify.error("Error al actualizar bitácora", res.error);
      }
    });
  };

  const handleCambiarCategoria = (cat: CategoriaBitacora) => {
    setCategoriaSeleccionada(cat);
    refrescarDatos(cat, rangoDias, busqueda);
  };

  const handleCambiarRango = (dias: number) => {
    setRangoDias(dias);
    refrescarDatos(categoriaSeleccionada, dias, busqueda);
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    refrescarDatos(categoriaSeleccionada, rangoDias, busqueda);
  };

  // Exportar registros visibles a CSV
  const exportarCSV = () => {
    if (registros.length === 0) {
      notify.warning("Sin datos", "No hay registros disponibles para exportar con los filtros actuales.");
      return;
    }

    try {
      const headers = [
        "ID",
        "Fecha (UTC)",
        "Categoría",
        "Acción",
        "Descripción",
        "Usuario Responsable",
        "Rol",
        "Tabla Afectada",
        "IP",
      ];

      const filas = registros.map((r) => [
        `"${r.id}"`,
        `"${r.fechaCreacion}"`,
        `"${r.categoria}"`,
        `"${r.accion}"`,
        `"${r.descripcion.replace(/"/g, '""')}"`,
        `"${r.usuarioNombre.replace(/"/g, '""')}"`,
        `"${r.usuarioRol}"`,
        `"${r.tablaAfectada}"`,
        `"${r.direccionIp || ""}"`,
      ]);

      const contenido = [headers.join(","), ...filas.map((f) => f.join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `bitacora_nolan_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);

      notify.success("Exportación completada", "Se descargó el archivo CSV de la bitácora.");
    } catch {
      notify.error("Error al exportar", "No se pudo generar el archivo de auditoría.");
    }
  };

  // Badge y colores por categoría
  const getCategoriaBadge = (cat: CategoriaBitacora) => {
    switch (cat) {
      case "EMPLEADOS":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          icon: UserCheck,
          label: "Personal",
        };
      case "HORARIO":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          icon: Clock,
          label: "Horario Laboral",
        };
      case "ZONAS_VIAJE":
        return {
          bg: "bg-purple-50 text-purple-700 border-purple-200",
          icon: MapPin,
          label: "Zonas de Viaje",
        };
      case "VACACIONES":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          icon: CalendarCheck,
          label: "Vacaciones LFT",
        };
      case "JUSTIFICACIONES":
        return {
          bg: "bg-teal-50 text-teal-800 border-teal-200",
          icon: FileCheck2,
          label: "Justificaciones",
        };
      default:
        return {
          bg: "bg-zinc-100 text-zinc-700 border-zinc-200",
          icon: Layers,
          label: "Sistema",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              Bitácora de Auditoría
            </h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 font-mono">
              <ShieldCheck className="h-3 w-3" /> Inmutable
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl leading-relaxed">
            Registro cronológico inmutable de todos los movimientos administrativos: altas de personal, cambios de horario laboral, zonas geográficas de viaje y resoluciones de incidencias.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refrescarDatos()}
            disabled={isPending}
            className="h-9 rounded-xl text-xs font-semibold gap-1.5 bg-white border-zinc-200 shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportarCSV}
            className="h-9 rounded-xl text-xs font-semibold gap-1.5 bg-white border-zinc-200 shadow-2xs text-zinc-700 hover:text-zinc-900"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* Tarjetas de Métricas Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs bg-white">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Total Movimientos</span>
              <div className="h-8 w-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
                <ScrollText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 font-mono">
              {metricas.totalMovimientos}
            </div>
            <p className="text-[10px] text-zinc-400 mt-0.5">En el periodo seleccionado</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs bg-white">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Expedientes & Altas</span>
              <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 font-mono">
              {metricas.totalEmpleados}
            </div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Altas, ediciones y bajas</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs bg-white">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">Jornadas & Horarios</span>
              <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 font-mono">
              {metricas.totalHorarios}
            </div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Horario oficial y tolerancias</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs bg-white">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500">LFT & Justificaciones</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CalendarCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 font-mono">
              {metricas.totalVacacionesJustificaciones}
            </div>
            <p className="text-[10px] text-zinc-400 mt-0.5">Vacaciones y faltas aprobadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros, Categorías y Búsqueda */}
      <Card className="rounded-2xl border-zinc-200/90 shadow-2xs bg-white overflow-hidden">
        <div className="p-4 space-y-3.5">
          {/* Fila 1: Selector de Categorías (Pills) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(
              [
                { id: "TODOS", label: "Todos los eventos" },
                { id: "EMPLEADOS", label: "Personal y Altas" },
                { id: "HORARIO", label: "Horario Laboral" },
                { id: "ZONAS_VIAJE", label: "Zonas de Viaje" },
                { id: "VACACIONES", label: "Vacaciones LFT" },
                { id: "JUSTIFICACIONES", label: "Justificaciones" },
              ] as const
            ).map((cat) => {
              const activa = categoriaSeleccionada === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCambiarCategoria(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activa
                      ? "bg-zinc-900 text-white shadow-xs"
                      : "bg-zinc-100/80 hover:bg-zinc-200/70 text-zinc-600"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Fila 2: Búsqueda y Rango de Fechas */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <form onSubmit={handleBuscar} className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por empleado, administrador, acción o motivo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full h-10 rounded-xl border border-zinc-200 bg-[#F9F9FB] pl-9 pr-3.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            </form>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[#F9F9FB] border border-zinc-200 p-1 rounded-xl">
                {[
                  { dias: 7, label: "7 días" },
                  { dias: 30, label: "30 días" },
                  { dias: 90, label: "90 días" },
                  { dias: 0, label: "Histórico" },
                ].map((r) => (
                  <button
                    key={r.dias}
                    type="button"
                    onClick={() => handleCambiarRango(r.dias)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                      rangoDias === r.dias
                        ? "bg-white text-zinc-900 shadow-2xs border border-zinc-200/60"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Listado de Registros */}
        <div className="border-t border-zinc-100">
          {registros.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="h-10 w-10 mx-auto rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                <ScrollText className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-zinc-700">No se encontraron movimientos</p>
              <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                No hay registros que coincidan con la categoría o filtros seleccionados en este periodo.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {registros.map((reg) => {
                const badgeInfo = getCategoriaBadge(reg.categoria);
                const Icono = badgeInfo.icon;
                const fechaObj = new Date(reg.fechaCreacion);

                const fechaFormateada = fechaObj.toLocaleDateString("es-MX", {
                  timeZone: "America/Merida",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                const horaFormateada = fechaObj.toLocaleTimeString("es-MX", {
                  timeZone: "America/Merida",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                });

                return (
                  <div
                    key={reg.id}
                    className="p-4 hover:bg-zinc-50/70 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-600 shrink-0 mt-0.5">
                        <Icono className="h-4 w-4" />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-zinc-900 leading-tight">
                            {reg.descripcion}
                          </span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0.2 font-medium ${badgeInfo.bg}`}>
                            {badgeInfo.label}
                          </Badge>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {reg.accion}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
                          <span>
                            Por: <strong className="text-zinc-700">{reg.usuarioNombre}</strong> ({reg.usuarioRol})
                          </span>
                          <span className="text-zinc-300">•</span>
                          <span className="font-mono text-zinc-600">
                            {fechaFormateada} a las {horaFormateada}
                          </span>
                          {reg.direccionIp && (
                            <>
                              <span className="text-zinc-300">•</span>
                              <span className="font-mono text-[10px] text-zinc-400">
                                IP: {reg.direccionIp}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRegistroDetalle(reg)}
                        className="h-8 px-2.5 rounded-lg text-[11px] font-semibold gap-1 text-zinc-700 bg-white border-zinc-200 hover:bg-zinc-100 shadow-2xs"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Ver Trazabilidad</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Modal / Drawer de Detalle y Trazabilidad Inmutable */}
      {registroDetalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/65 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRegistroDetalle(null);
          }}
        >
          <div
            className="w-full max-w-xl max-h-[92dvh] flex flex-col rounded-3xl bg-white border border-zinc-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-[#FAFAFC] shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Registro de Auditoría Inmutable</h3>
                  <p className="text-[10px] font-mono text-zinc-400">ID: {registroDetalle.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegistroDetalle(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                aria-label="Cerrar ventana"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Resumen del movimiento */}
              <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                  Movimiento Registrado
                </span>
                <p className="text-xs font-bold text-zinc-900">
                  {registroDetalle.descripcion}
                </p>
                <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px] text-zinc-600">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {registroDetalle.accion}
                  </Badge>
                  <span>Tabla: <code className="font-mono font-bold text-zinc-800">{registroDetalle.tablaAfectada}</code></span>
                </div>
              </div>

              {/* Metadatos de Autoría y Tiempos */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl border border-zinc-200/80 bg-white">
                <div>
                  <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Autor / Responsable</span>
                  <p className="text-xs font-bold text-zinc-900 mt-0.5">{registroDetalle.usuarioNombre}</p>
                  <p className="text-[10px] text-zinc-500 font-medium">{registroDetalle.usuarioRol}</p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 font-semibold block uppercase">Fecha y Hora Legal</span>
                  <p className="text-xs font-mono font-bold text-zinc-900 mt-0.5">
                    {new Date(registroDetalle.fechaCreacion).toLocaleString("es-MX", {
                      timeZone: "America/Merida",
                      dateStyle: "medium",
                      timeStyle: "medium",
                    })}
                  </p>
                  <p className="text-[10px] text-zinc-500">Zona America/Merida</p>
                </div>
                {registroDetalle.direccionIp && (
                  <div className="col-span-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500">Dirección IP de origen:</span>
                    <span className="font-mono font-bold text-zinc-800">{registroDetalle.direccionIp}</span>
                  </div>
                )}
              </div>

              {/* Comparador de Valores (Previos vs Nuevos) */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-zinc-800 block">
                  Detalle de Cambios en la Base de Datos
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Valores Previos */}
                  <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200/70 space-y-1.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block">
                      Valores Anteriores
                    </span>
                    {registroDetalle.valoresPrevios ? (
                      <pre className="text-[10px] font-mono text-zinc-700 bg-white p-2.5 rounded-xl border border-zinc-200 overflow-x-auto max-h-48 whitespace-pre-wrap">
                        {JSON.stringify(registroDetalle.valoresPrevios, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-[11px] text-zinc-400 italic py-2">
                        Sin datos anteriores (Registro de creación nueva).
                      </p>
                    )}
                  </div>

                  {/* Valores Nuevos */}
                  <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-200/70 space-y-1.5">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide block">
                      Valores Nuevos Asignados
                    </span>
                    {registroDetalle.valoresNuevos ? (
                      <pre className="text-[10px] font-mono text-zinc-800 bg-white p-2.5 rounded-xl border border-emerald-200 overflow-x-auto max-h-48 whitespace-pre-wrap">
                        {JSON.stringify(registroDetalle.valoresNuevos, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-[11px] text-zinc-400 italic py-2">
                        Sin datos nuevos (Registro eliminado o revocado).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Pie de modal */}
            <div className="flex items-center justify-end px-5 py-3 border-t border-zinc-100 bg-[#FAFAFC] shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRegistroDetalle(null)}
                className="h-9 px-4 text-xs font-semibold rounded-xl text-zinc-700"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
