"use client";

import * as React from "react";
import { useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/feedback/toast";
import { cambiarEstadoEmpleado, type EmpleadoRow } from "../actions";

interface CambiarEstadoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  empleado: EmpleadoRow | null;
  onChanged: (empleado: EmpleadoRow) => void;
}

export function CambiarEstadoDialog({
  isOpen,
  onClose,
  empleado,
  onChanged,
}: CambiarEstadoDialogProps) {
  const [isPending, startTransition] = useTransition();

  if (!isOpen || !empleado) return null;

  const vaADesactivar = empleado.activo; // Si está activo, la acción es darlo de baja

  async function handleConfirmar() {
    if (!empleado) return;

    startTransition(async () => {
      try {
        const nuevoEstado = !empleado.activo;
        const res = await cambiarEstadoEmpleado(empleado.id, nuevoEstado);

        if (!res.success || !res.empleado) {
          notify.error(
            "Error al cambiar estado",
            res.error || "No se pudo actualizar el estado del empleado."
          );
          return;
        }

        notify.success(
          nuevoEstado ? "Empleado reactivado" : "Baja lógica confirmada",
          res.message || "El estado se actualizó correctamente en la base de datos."
        );
        onChanged(res.empleado);
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error inesperado al conectar con el servidor.";
        notify.error("Error", msg);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-zinc-200/90 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-zinc-100 bg-[#FAFAFC]">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-xs ${
                vaADesactivar
                  ? "bg-rose-100 text-rose-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {vaADesactivar ? (
                <ShieldAlert className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
                {vaADesactivar ? "Confirmar Baja Lógica" : "Reactivar Empleado"}
              </h2>
              <p className="text-[11px] text-zinc-500">
                {vaADesactivar
                  ? "Desactivación temporal o definitiva del trabajador."
                  : "Restablece el estatus activo del trabajador."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-zinc-400 hover:text-zinc-700 transition-colors p-1 rounded-lg hover:bg-zinc-100 disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Contenido explicativo */}
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-zinc-200/80 bg-[#F9F9FB] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900">
                {empleado.nombre} {empleado.apellidos}
              </span>
              <span className="text-[10px] font-mono font-medium text-zinc-500 bg-white border border-zinc-200 px-1.5 py-0.5 rounded">
                {empleado.numero_empleado}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span>{empleado.puesto}</span>
              <span>•</span>
              <span>ID Checador: {empleado.codigo_biometrico}</span>
            </div>
          </div>

          {vaADesactivar ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" strokeWidth={1.75} />
                <span>Preservación histórica de datos</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed pl-5">
                Al aplicar la baja lógica, el empleado se ocultará de los filtros activos y no figurará en las listas de checado diario. 
                <strong> Su historial de asistencias y registros previos permanecerá 100% intacto</strong> para efectos de auditoría y reportes. Podrás reactivarlo en cualquier momento.
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-600 leading-relaxed">
              Al reactivar a este trabajador, volverá a listarse en los catálogos activos y los eventos recibidos desde el checador físico ZKTeco MB10V se registrarán a su nombre de forma normal.
            </p>
          )}

          {/* Botones */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={onClose}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={vaADesactivar ? "danger" : "primary"}
              size="sm"
              disabled={isPending}
              onClick={handleConfirmar}
              className="rounded-xl text-xs"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" strokeWidth={2} />
                  Actualizando estado...
                </>
              ) : vaADesactivar ? (
                "Aplicar Baja Lógica"
              ) : (
                "Reactivar Trabajador"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
