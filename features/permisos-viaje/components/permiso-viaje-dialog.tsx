"use client";

import * as React from "react";
import { useState, useTransition, useEffect } from "react";
import {
  X,
  Plane,
  Loader2,
  Calendar,
  MapPin,
  Briefcase,
  User,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/feedback/toast";
import { GeofenceMapPicker } from "@/features/configuracion/components/geofence-map-picker";
import {
  crearPermisoExtraordinario,
  type UbicacionExtraordinariaRow,
} from "../actions";
import type { EmpleadoRow } from "@/features/empleados/actions";

interface PermisoViajeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  empleados: EmpleadoRow[];
  onSaved: (permiso: UbicacionExtraordinariaRow) => void;
}

export function PermisoViajeDialog({
  isOpen,
  onClose,
  empleados,
  onSaved,
}: PermisoViajeDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Form states
  const [empleadoId, setEmpleadoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [nombreLugar, setNombreLugar] = useState("");
  const [direccion, setDireccion] = useState("");
  const [latitud, setLatitud] = useState("19.432608");
  const [longitud, setLongitud] = useState("-99.133209");
  const [radioMetros, setRadioMetros] = useState("150");

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  useEffect(() => {
    if (isOpen) {
      const hoy = new Date();
      const hoyStr = hoy.toISOString().slice(0, 10);
      setFechaInicio(hoyStr);

      // Default: 3 días de vigencia
      const fin = new Date(hoy);
      fin.setDate(fin.getDate() + 3);
      setFechaFin(fin.toISOString().slice(0, 10));

      setEmpleadoId(empleados[0]?.id || "");
      setMotivo("");
      setNombreLugar("");
      setDireccion("");
      setErrorLocal(null);
    }
  }, [isOpen, empleados]);

  if (!isOpen) return null;

  function aplicarDuracion(dias: number) {
    const inicio = fechaInicio ? new Date(fechaInicio) : new Date();
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + (dias - 1));
    setFechaFin(fin.toISOString().slice(0, 10));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorLocal(null);

    const formData = new FormData();
    formData.append("empleado_id", empleadoId);
    formData.append("motivo", motivo);
    formData.append("nombre_lugar", nombreLugar);
    formData.append("direccion", direccion);
    formData.append("latitud", latitud);
    formData.append("longitud", longitud);
    formData.append("radio_tolerancia_metros", radioMetros);
    formData.append("fecha_inicio", fechaInicio);
    formData.append("fecha_fin", fechaFin);

    startTransition(async () => {
      const res = await crearPermisoExtraordinario(formData);
      if (!res.success || !res.permiso) {
        setErrorLocal(res.error || "No se pudo registrar la ubicación extraordinaria.");
        notify.error("Error", res.error);
        return;
      }

      notify.success("Ubicación de viaje autorizada", res.message);
      onSaved(res.permiso);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white border border-zinc-200/90 shadow-2xl overflow-hidden my-6"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-[#FAFAFC]">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Plane className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
                Autorizar Ubicación Extraordinaria de Viaje
              </h2>
              <p className="text-[11px] text-zinc-500">
                Habilita una geocerca temporal (de 1 día a 2 semanas) para que un trabajador comisionado pueda checar online.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-zinc-400 hover:text-zinc-700 transition-colors p-1.5 rounded-lg hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {errorLocal && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {errorLocal}
            </div>
          )}

          {/* Empleado y Motivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="empleado_id" className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-zinc-400" />
                Empleado Comisionado <span className="text-rose-500">*</span>
              </label>
              <select
                id="empleado_id"
                required
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                disabled={isPending}
                className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
              >
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombre} {emp.apellidos} ({emp.puesto} - {emp.numero_empleado})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="motivo" className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-zinc-400" />
                Motivo del Viaje / Comisión <span className="text-rose-500">*</span>
              </label>
              <input
                id="motivo"
                type="text"
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. Compra de refacciones foráneas, reparación"
                disabled={isPending}
                className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Nombre del Destino y Dirección */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="nombre_lugar" className="text-xs font-medium text-zinc-700">
                Nombre del Lugar / Sede de Viaje <span className="text-rose-500">*</span>
              </label>
              <input
                id="nombre_lugar"
                type="text"
                required
                value={nombreLugar}
                onChange={(e) => setNombreLugar(e.target.value)}
                placeholder="Ej. Hotel Real Toluca / Taller Asociado Norte"
                disabled={isPending}
                className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="direccion" className="text-xs font-medium text-zinc-700">
                Dirección o Referencia
              </label>
              <input
                id="direccion"
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Dirección resuelta automáticamente por el mapa..."
                disabled={isPending}
                className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Vigencia con Atajos (1 día a 14 días) */}
          <div className="rounded-xl border border-zinc-200/80 bg-[#FAF9F6] p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-600" />
                Vigencia Temporal (Caduca automáticamente en la fecha fin)
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-400 mr-1">Atajos:</span>
                <button
                  type="button"
                  onClick={() => aplicarDuracion(1)}
                  className="text-[10px] bg-white border border-zinc-200 px-2 py-0.5 rounded hover:bg-zinc-100 cursor-pointer"
                >
                  1 día
                </button>
                <button
                  type="button"
                  onClick={() => aplicarDuracion(3)}
                  className="text-[10px] bg-white border border-zinc-200 px-2 py-0.5 rounded hover:bg-zinc-100 cursor-pointer"
                >
                  3 días
                </button>
                <button
                  type="button"
                  onClick={() => aplicarDuracion(7)}
                  className="text-[10px] bg-white border border-zinc-200 px-2 py-0.5 rounded hover:bg-zinc-100 cursor-pointer"
                >
                  1 semana
                </button>
                <button
                  type="button"
                  onClick={() => aplicarDuracion(14)}
                  className="text-[10px] bg-white border border-zinc-200 px-2 py-0.5 rounded hover:bg-zinc-100 cursor-pointer font-semibold text-blue-600"
                >
                  2 semanas (máx)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <div className="space-y-1 min-w-0">
                <label htmlFor="fecha_inicio" className="text-[11px] font-medium text-zinc-600">
                  Fecha de Inicio
                </label>
                <input
                  id="fecha_inicio"
                  type="date"
                  required
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  disabled={isPending}
                  className="w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900"
                />
              </div>

              <div className="space-y-1 min-w-0">
                <label htmlFor="fecha_fin" className="text-[11px] font-medium text-zinc-600">
                  Fecha de Caducidad (Fin)
                </label>
                <input
                  id="fecha_fin"
                  type="date"
                  required
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  disabled={isPending}
                  className="w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900"
                />
              </div>
            </div>
          </div>

          {/* Mapa con Buscador de Google Places para seleccionar el destino */}
          <div className="pt-1">
            <GeofenceMapPicker
              latitud={parseFloat(latitud) || 19.432608}
              longitud={parseFloat(longitud) || -99.133209}
              radioMetros={parseInt(radioMetros, 10) || 200}
              disabled={isPending}
              onLocationChange={(newLat, newLng, direccionSugerida) => {
                setLatitud(newLat.toFixed(7));
                setLongitud(newLng.toFixed(7));
                if (direccionSugerida) {
                  setDireccion(direccionSugerida);
                  if (!nombreLugar) {
                    setNombreLugar(direccionSugerida.split(",")[0] || "Destino de viaje");
                  }
                }
              }}
            />
          </div>

          {/* Radio de tolerancia para el viaje */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="radio_tolerancia" className="font-medium text-zinc-700">
                Radio de Tolerancia en el Destino ({radioMetros} metros)
              </label>
              <span className="text-[10px] text-zinc-400">Rango permitido: 2m - 150m</span>
            </div>
            <input
              id="radio_tolerancia"
              type="range"
              min={2}
              max={150}
              step={1}
              value={Math.min(150, Math.max(2, parseInt(radioMetros, 10) || 150))}
              onChange={(e) => setRadioMetros(e.target.value)}
              disabled={isPending}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
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
              type="submit"
              size="sm"
              disabled={isPending}
              className="rounded-xl text-xs shadow-xs"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Autorizando Viaje...
                </>
              ) : (
                "Autorizar Ubicación Extraordinaria"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
