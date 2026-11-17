"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  Filter,
  User,
  Calendar,
  Loader2,
  X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { notify } from "@/lib/feedback/toast";
import {
  resolverIncidenciaAdmin,
  obtenerUrlFirmadaJustificante,
  type IncidenciaConEmpleado,
} from "../actions";

interface IncidenciasVistaProps {
  incidenciasIniciales: IncidenciaConEmpleado[];
  empleados: { id: string; nombre: string; apellidos: string; numero_empleado: string }[];
  monitoreoStorage?: { archivosTotales: number; tamanoFormateado: string };
}

export function IncidenciasVista({
  incidenciasIniciales,
  empleados,
  monitoreoStorage,
}: IncidenciasVistaProps) {
  const [incidencias, setIncidencias] = useState<IncidenciaConEmpleado[]>(incidenciasIniciales);
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroEmpleado, setFiltroEmpleado] = useState<string>("TODOS");

  // Modal para rechazar con motivo obligatorio
  const [modalRechazo, setModalRechazo] = useState<{ id: string; tipo: string; empleadoNombre: string } | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  const [isResolving, startResolvingTransition] = useTransition();
  const [cargandoDocId, setCargandoDocId] = useState<string | null>(null);

  // Filtrado reactivo en cliente
  const incidenciasFiltradas = incidencias.filter((item) => {
    if (filtroEstado !== "TODOS" && item.estado !== filtroEstado) return false;
    if (filtroTipo !== "TODOS" && item.tipo !== filtroTipo) return false;
    if (filtroEmpleado !== "TODOS" && item.empleado_id !== filtroEmpleado) return false;
    return true;
  });

  // Contador de pendientes
  const totalPendientes = incidencias.filter((i) => i.estado === "PENDIENTE").length;

  // Aprobar solicitud directamente
  function handleAprobar(id: string) {
    startResolvingTransition(async () => {
      const res = await resolverIncidenciaAdmin({
        incidenciaId: id,
        accion: "APROBADA",
        comentario: "Aprobada por la administración.",
      });

      if (!res.success) {
        notify.error("Error al aprobar", res.error);
        return;
      }

      notify.success("Solicitud Aprobada", res.message);
      setIncidencias((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                estado: "APROBADA",
                respuesta_administrador: "Aprobada por la administración.",
                documento_estado: i.documento_path ? "ACEPTADO" : i.documento_estado,
              }
            : i
        )
      );
    });
  }

  // Confirmar rechazo con motivo
  function handleConfirmarRechazo(e: React.FormEvent) {
    e.preventDefault();
    if (!modalRechazo) return;

    if (!motivoRechazo.trim() || motivoRechazo.trim().length < 5) {
      notify.error("Motivo obligatorio", "Debes ingresar una explicación de al menos 5 caracteres para rechazar.");
      return;
    }

    startResolvingTransition(async () => {
      const res = await resolverIncidenciaAdmin({
        incidenciaId: modalRechazo.id,
        accion: "RECHAZADA",
        comentario: motivoRechazo.trim(),
      });

      if (!res.success) {
        notify.error("Error al rechazar", res.error);
        return;
      }

      notify.success("Solicitud Rechazada", res.message);
      setIncidencias((prev) =>
        prev.map((i) =>
          i.id === modalRechazo.id
            ? {
                ...i,
                estado: "RECHAZADA",
                respuesta_administrador: motivoRechazo.trim(),
                documento_estado: i.documento_path ? "RECHAZADO" : i.documento_estado,
              }
            : i
        )
      );
      setModalRechazo(null);
      setMotivoRechazo("");
    });
  }

  // Ver documento médico privado mediante URL firmada temporal de 10 min
  async function handleVerDocumento(path: string, id: string) {
    setCargandoDocId(id);
    try {
      const res = await obtenerUrlFirmadaJustificante(path);
      if (!res.success || !res.signedUrl) {
        notify.error("Error de acceso", res.error || "No se pudo generar la URL segura.");
        return;
      }

      // Abrir en pestaña nueva con aislamiento de seguridad
      window.open(res.signedUrl, "_blank", "noopener,noreferrer");
      notify.info("Documento Abierto", "URL segura válida por 10 minutos generada.");
    } catch {
      notify.error("Error inesperado", "Fallo al consultar el servicio de almacenamiento.");
    } finally {
      setCargandoDocId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado y Monitoreo de Cuota Gratuita */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Control de Incidencias y Justificantes
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Revisión administrativa y auditoría de solicitudes de vacaciones, permisos y justificaciones médicas.
          </p>
        </div>

        {monitoreoStorage && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-zinc-200 bg-white shadow-2xs text-xs text-zinc-600 shrink-0">
            <HardDrive className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-semibold text-zinc-900 block">Uso Storage: {monitoreoStorage.tamanoFormateado}</span>
              <span className="text-[10px] text-zinc-500">{monitoreoStorage.archivosTotales} archivos en bucket privado</span>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Filtros */}
      <Card className="rounded-2xl border-zinc-200/90 shadow-2xs bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Estatus</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-1.5 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
              >
                <option value="TODOS">Todos los estatus</option>
                <option value="PENDIENTE">Solo Pendientes ({totalPendientes})</option>
                <option value="APROBADA">Aprobadas</option>
                <option value="RECHAZADA">Rechazadas</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Tipo de Solicitud</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-1.5 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
              >
                <option value="TODOS">Todos los tipos</option>
                <option value="VACACIONES">Vacaciones</option>
                <option value="INCAPACIDAD">Incapacidad Médica (IMSS)</option>
                <option value="FALTA_JUSTIFICADA">Falta Justificada</option>
                <option value="PERMISO">Permiso Laboral</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Empleado</label>
              <select
                value={filtroEmpleado}
                onChange={(e) => setFiltroEmpleado(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-1.5 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
              >
                <option value="TODOS">Todos los empleados</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    #{emp.numero_empleado} — {emp.nombre} {emp.apellidos}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Solicitudes */}
      <div className="space-y-3">
        {incidenciasFiltradas.length === 0 ? (
          <Card className="rounded-2xl border-zinc-200 shadow-2xs">
            <CardContent className="py-12 text-center text-zinc-400 text-xs">
              No se encontraron solicitudes con los filtros aplicados.
            </CardContent>
          </Card>
        ) : (
          incidenciasFiltradas.map((inc) => {
            const empNombre = inc.empleado
              ? `${inc.empleado.nombre} ${inc.empleado.apellidos}`
              : "Empleado";

            return (
              <Card
                key={inc.id}
                className={`rounded-2xl border transition-colors shadow-2xs ${
                  inc.estado === "PENDIENTE"
                    ? "border-amber-200/80 bg-amber-50/20"
                    : "border-zinc-200/80 bg-white"
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    {/* Información Principal */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-zinc-900">{empNombre}</span>
                        {inc.empleado && (
                          <span className="text-[11px] text-zinc-500 font-mono">
                            (#{inc.empleado.numero_empleado} · {inc.empleado.puesto})
                          </span>
                        )}
                        <Badge
                          variant={
                            inc.estado === "APROBADA"
                              ? "success"
                              : inc.estado === "RECHAZADA"
                              ? "danger"
                              : "warning"
                          }
                          className="text-[10px]"
                        >
                          {inc.estado}
                        </Badge>

                        {/* Badges de auditoría */}
                        {inc.extemporanea && (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                            Retroactiva / Extemporánea
                          </Badge>
                        )}
                        {inc.documento_path && (
                          <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300 bg-blue-50">
                            Con Justificante
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-600 flex-wrap">
                        <div className="flex items-center gap-1 font-semibold text-zinc-800">
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                          <span>
                            {inc.tipo} ({inc.dias_solicitados_efectivos || 1} días hábiles)
                          </span>
                        </div>
                        <span>·</span>
                        <span>
                          Del <strong>{inc.fecha_inicio}</strong> al <strong>{inc.fecha_fin}</strong>
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl border border-zinc-100 bg-[#F9F9FB] text-xs text-zinc-800">
                        <span className="font-semibold text-zinc-900 block text-[11px] mb-0.5">Motivo del trabajador:</span>
                        &ldquo;{inc.motivo}&rdquo;
                      </div>

                      {/* Documento médico adjunto */}
                      {inc.documento_path && (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerDocumento(inc.documento_path!, inc.id)}
                            disabled={cargandoDocId === inc.id}
                            className="h-7 text-xs rounded-lg gap-1.5 border-blue-200 text-blue-800 hover:bg-blue-50"
                          >
                            {cargandoDocId === inc.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ExternalLink className="h-3 w-3" />
                            )}
                            Ver Justificante Privado
                          </Button>
                          <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px]">
                            {inc.documento_nombre_original || "comprobante"}
                          </span>
                        </div>
                      )}

                      {/* Resolución previa */}
                      {inc.respuesta_administrador && (
                        <div className="p-2 rounded-lg bg-zinc-100 text-[11px] text-zinc-700 mt-2">
                          <strong>Resolución:</strong> {inc.respuesta_administrador}
                        </div>
                      )}
                    </div>

                    {/* Acciones de Resolución */}
                    {inc.estado === "PENDIENTE" && (
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setModalRechazo({
                              id: inc.id,
                              tipo: inc.tipo,
                              empleadoNombre: empNombre,
                            })
                          }
                          disabled={isResolving}
                          className="h-8 text-xs rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAprobar(inc.id)}
                          disabled={isResolving}
                          className="h-8 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Aprobar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal para ingresar motivo de rechazo */}
      {modalRechazo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 bg-[#FAFAFC]">
              <h3 className="text-xs font-bold text-zinc-900">Rechazar Solicitud</h3>
              <button
                type="button"
                onClick={() => setModalRechazo(null)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmarRechazo} className="p-5 space-y-3.5 text-xs">
              <p className="text-zinc-600">
                Indica el motivo justificado de rechazo para la solicitud de{" "}
                <strong>{modalRechazo.empleadoNombre}</strong> ({modalRechazo.tipo}).
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 block">Motivo de Rechazo (Mínimo 5 caracteres)</label>
                <textarea
                  required
                  rows={3}
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder="Explica la causa del rechazo..."
                  className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] p-2.5 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalRechazo(null)}
                  disabled={isResolving}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isResolving}
                  className="rounded-xl text-xs bg-red-600 hover:bg-red-700 text-white shadow-xs"
                >
                  {isResolving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Procesando...
                    </>
                  ) : (
                    "Confirmar Rechazo"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
