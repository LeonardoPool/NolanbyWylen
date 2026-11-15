"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  Plane,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/lib/feedback/toast";
import {
  eliminarPermisoExtraordinario,
  type PermisoConEmpleado,
  type UbicacionExtraordinariaRow,
} from "../actions";
import { PermisoViajeDialog } from "./permiso-viaje-dialog";
import type { EmpleadoRow } from "@/features/empleados/actions";

interface PermisosViajeListaProps {
  permisosIniciales: PermisoConEmpleado[];
  empleados: EmpleadoRow[];
  esAdmin: boolean;
}

export function PermisosViajeLista({
  permisosIniciales,
  empleados,
  esAdmin,
}: PermisosViajeListaProps) {
  const [permisos, setPermisos] = useState<PermisoConEmpleado[]>(permisosIniciales);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleGuardado(nuevoPermiso: UbicacionExtraordinariaRow) {
    const emp = empleados.find((e) => e.id === nuevoPermiso.empleado_id);
    const hoy = new Date();
    const fin = new Date(nuevoPermiso.fecha_fin);
    const diff = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    const item: PermisoConEmpleado = {
      ...nuevoPermiso,
      empleado: emp
        ? {
            id: emp.id,
            nombre: emp.nombre,
            apellidos: emp.apellidos,
            numero_empleado: emp.numero_empleado,
            puesto: emp.puesto,
          }
        : null,
      diasRestantes: Math.max(0, diff),
      estaExpirado: diff < 0,
    };

    setPermisos((prev) => [item, ...prev]);
  }

  function handleEliminar(id: string, nombreLugar: string) {
    if (!confirm(`¿Deseas revocar el permiso de viaje para "${nombreLugar}"?`)) {
      return;
    }

    startDeleteTransition(async () => {
      const res = await eliminarPermisoExtraordinario(id);
      if (!res.success) {
        notify.error("Error al revocar", res.error);
        return;
      }

      notify.success("Ubicación revocada", "El permiso ha sido eliminado exitosamente.");
      setPermisos((prev) => prev.filter((p) => p.id !== id));
    });
  }

  const activosCount = permisos.filter((p) => !p.estaExpirado).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <Plane className="h-4 w-4 text-blue-600" />
            Permisos Extraordinarios de Viaje y Comisiones
          </h3>
          <p className="text-xs text-zinc-500">
            Ubicaciones temporales vigentes (de 1 día hasta 2 semanas). Al vencer su fecha límite, la ubicación se elimina automáticamente.
          </p>
        </div>

        {esAdmin && (
          <Button
            size="sm"
            onClick={() => setModalAbierto(true)}
            className="rounded-xl text-xs shrink-0 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Autorizar Ubicación de Viaje
          </Button>
        )}
      </div>

      {permisos.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-[#FAF9F6] p-8 text-center">
          <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mx-auto mb-2 border border-zinc-200/60">
            <Plane className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h4 className="text-xs font-semibold text-zinc-800">
            No hay permisos extraordinarios de viaje activos
          </h4>
          <p className="text-[11px] text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Cuando un trabajador salga a reparar una unidad foránea o de compras de refacciones, puedes asignarle una geocerca temporal aquí.
          </p>
          {esAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalAbierto(true)}
              className="mt-4 text-xs rounded-xl"
            >
              <Plus className="h-3 w-3 mr-1" />
              Dar de alta primer viaje
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {permisos.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border p-4 space-y-2.5 transition-all shadow-2xs ${
                p.estaExpirado
                  ? "border-zinc-200 bg-zinc-50/70 opacity-60"
                  : "border-blue-200/80 bg-white hover:border-blue-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-zinc-900">
                      {p.empleado
                        ? `${p.empleado.nombre} ${p.empleado.apellidos}`
                        : "Empleado"}
                    </span>
                    {p.empleado && (
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                        {p.empleado.numero_empleado}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500">{p.empleado?.puesto}</p>
                </div>

                <div>
                  {p.estaExpirado ? (
                    <Badge variant="outline" className="text-zinc-500">
                      Caducado
                    </Badge>
                  ) : p.diasRestantes === 0 ? (
                    <Badge variant="warning">Vence Hoy</Badge>
                  ) : (
                    <Badge variant="success">
                      Vence en {p.diasRestantes} día{p.diasRestantes === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-100 bg-[#F9F9FB] p-2.5 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-800">
                  <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span>{p.nombre_lugar}</span>
                </div>
                <p className="text-[11px] text-zinc-500 pl-5">
                  <strong>Motivo:</strong> {p.motivo}
                </p>
                {p.direccion && (
                  <p className="text-[10px] text-zinc-400 pl-5 truncate">{p.direccion}</p>
                )}
                <div className="flex items-center gap-3 text-[10px] text-zinc-500 pl-5 pt-0.5">
                  <span>Radio: {p.radio_tolerancia_metros}m</span>
                  <span>•</span>
                  <span>
                    Vigencia: {p.fecha_inicio} al {p.fecha_fin}
                  </span>
                </div>
              </div>

              {esAdmin && (
                <div className="flex items-center justify-end pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => handleEliminar(p.id, p.nombre_lugar)}
                    className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Revocar Permiso
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal para Crear Permiso Extraordinario */}
      <PermisoViajeDialog
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        empleados={empleados}
        onSaved={handleGuardado}
      />
    </div>
  );
}
