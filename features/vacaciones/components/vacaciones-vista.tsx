"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  History,
  PlusCircle,
  Calculator,
  User,
  Clock,
  ShieldCheck,
  ChevronRight,
  Loader2,
  X,
  FileCheck2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { notify } from "@/lib/feedback/toast";
import {
  registrarAjusteVacacionalAdmin,
  simularDiasHabilesVacaciones,
  type FichaVacacionalEmpleado,
} from "../actions";
import { calcularDiasPorAnioServicioLFT } from "@/lib/lft/vacaciones-lft";

interface VacacionesVistaProps {
  fichasIniciales: FichaVacacionalEmpleado[];
  esAdmin?: boolean;
  errorInicial?: string;
}

export function VacacionesVista({
  fichasIniciales,
  esAdmin = true,
  errorInicial,
}: VacacionesVistaProps) {
  const [fichas, setFichas] = useState<FichaVacacionalEmpleado[]>(fichasIniciales);
  const [fichaSeleccionada, setFichaSeleccionada] = useState<FichaVacacionalEmpleado | null>(
    fichasIniciales[0] || null
  );

  // Modal de Ajuste / Carga Histórica
  const [modalAjuste, setModalAjuste] = useState(false);
  const [tipoAjuste, setTipoAjuste] = useState<"CARGA_HISTORICA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO">("CARGA_HISTORICA");
  const [diasAjuste, setDiasAjuste] = useState<number>(1);
  const [motivoAjuste, setMotivoAjuste] = useState("");
  const [isSavingAjuste, startSavingAjuste] = useTransition();

  // Simulador interactivo de fechas
  const [simFechaInicio, setSimFechaInicio] = useState("");
  const [simFechaFin, setSimFechaFin] = useState("");
  const [simResultado, setSimResultado] = useState<{
    diasHabiles: number;
    diasNaturales: number;
    domingosExcluidos: number;
  } | null>(null);
  const [isSimulating, startSimulating] = useTransition();

  function handleSimular(e: React.FormEvent) {
    e.preventDefault();
    if (!simFechaInicio || !simFechaFin) return;

    startSimulating(async () => {
      const res = await simularDiasHabilesVacaciones(simFechaInicio, simFechaFin);
      setSimResultado(res);
    });
  }

  function handleGuardarAjuste(e: React.FormEvent) {
    e.preventDefault();
    if (!fichaSeleccionada) return;

    if (!motivoAjuste.trim() || motivoAjuste.trim().length < 5) {
      notify.error("Justificación obligatoria", "Ingresa una explicación de al menos 5 caracteres.");
      return;
    }

    startSavingAjuste(async () => {
      const res = await registrarAjusteVacacionalAdmin({
        empleadoId: fichaSeleccionada.empleadoId,
        tipo: tipoAjuste,
        dias: diasAjuste,
        motivo: motivoAjuste.trim(),
      });

      if (!res.success) {
        notify.error("Error al registrar ajuste", res.error);
        return;
      }

      notify.success("Ajuste Registrado", res.message);
      setModalAjuste(false);
      setMotivoAjuste("");
      setDiasAjuste(1);

      // Actualizar saldo visualmente
      const delta = tipoAjuste === "AJUSTE_NEGATIVO" ? -diasAjuste : diasAjuste;
      setFichas((prev) =>
        prev.map((f) =>
          f.empleadoId === fichaSeleccionada.empleadoId
            ? {
                ...f,
                ajustesSaldo: f.ajustesSaldo + delta,
                saldoDisponible: Math.max(0, f.saldoDisponible + delta),
              }
            : f
        )
      );

      if (fichaSeleccionada) {
        setFichaSeleccionada((prev) =>
          prev
            ? {
                ...prev,
                ajustesSaldo: prev.ajustesSaldo + delta,
                saldoDisponible: Math.max(0, prev.saldoDisponible + delta),
              }
            : null
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Gestión Integral de Vacaciones (LFT)
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Administración conforme a la Ley Federal del Trabajo: cálculo por aniversario, saldo append-only y descanso semanal.
          </p>
        </div>

        {fichaSeleccionada && esAdmin && (
          <Button
            size="sm"
            onClick={() => setModalAjuste(true)}
            className="rounded-xl text-xs gap-1.5 shadow-2xs self-start sm:self-auto cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Cargar Saldo / Ajuste Histórico
          </Button>
        )}
      </div>

      {/* Alerta de Error si ocurre */}
      {errorInicial && (
        <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorInicial}</span>
        </div>
      )}

      {/* Tarjeta Informativa LFT */}
      <Card className="rounded-2xl border-blue-200/80 bg-blue-50/30 shadow-2xs">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-700 space-y-1">
              <span className="font-bold text-zinc-900 block">Marco Legal Aplicable (Ley Federal del Trabajo):</span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-zinc-600">
                <li><strong>Art. 76:</strong> Los derechos se generan por aniversario cumplido de servicio (12 días al 1er año, 14 al 2do, etc.). No se generan por año calendario.</li>
                <li><strong>Art. 78:</strong> Los trabajadores tienen derecho preferente a disfrutar de al menos 12 días continuos de vacaciones.</li>
                <li><strong>Art. 80:</strong> Los trabajadores tendrán derecho a una prima no menor de veinticinco por ciento (25%) sobre los salarios del periodo.</li>
                <li><strong>Art. 81:</strong> Las vacaciones deben concederse dentro de los seis meses siguientes al cumplimiento del año de servicio.</li>
                <li><strong>Calendario:</strong> Lunes a sábado laborables (sábado cuenta como día de vacaciones; domingos y feriados oficiales del Art. 74 NO se descuentan).</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fichas de Empleados */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selector de Empleados */}
        <div className="lg:col-span-1 space-y-3">
          <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider px-1">
            Plantilla Laboral ({fichas.length})
          </span>

          {fichas.length === 0 ? (
            <Card className="rounded-2xl border-zinc-200 bg-white/70 p-6 text-center text-zinc-400 text-xs">
              No hay empleados activos en el catálogo para consultar vacaciones.
            </Card>
          ) : (
            <div className="space-y-2 max-h-[360px] lg:max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {fichas.map((f) => {
              const esActivo = fichaSeleccionada?.empleadoId === f.empleadoId;
              return (
                <div
                  key={f.empleadoId}
                  onClick={() => setFichaSeleccionada(f)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    esActivo
                      ? "border-zinc-900 bg-white shadow-sm ring-1 ring-zinc-900"
                      : "border-zinc-200 bg-white/70 hover:bg-white hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-zinc-900 block">{f.nombreCompleto}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        #{f.numeroEmpleado} · Ingreso: {f.fechaIngreso}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-emerald-600 block">
                        {f.saldoDisponible} días
                      </span>
                      <span className="text-[9px] text-zinc-400">Saldo Disp.</span>
                    </div>
                  </div>

                  {f.alertaPlazoArt81 && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>Plazo Art. 81 vencido (&gt;6 meses)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Detalle de Ficha Vacacional Seleccionada */}
        <div className="lg:col-span-2 space-y-6">
          {fichaSeleccionada ? (
            <>
              {/* Tarjetas de Saldo Desglosado */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="rounded-2xl border-zinc-200 bg-white shadow-2xs">
                  <CardContent className="p-3.5 text-center">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block">Devengados Ley</span>
                    <span className="text-xl font-extrabold text-zinc-900 mt-1 block">
                      {fichaSeleccionada.diasDevengadosLey}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-medium">
                      {fichaSeleccionada.aniosServicioCumplidos} años cumplidos
                    </span>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-zinc-200 bg-white shadow-2xs">
                  <CardContent className="p-3.5 text-center">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block">Ajustes / Cargas</span>
                    <span className="text-xl font-extrabold text-blue-600 mt-1 block">
                      {fichaSeleccionada.ajustesSaldo >= 0 ? `+${fichaSeleccionada.ajustesSaldo}` : fichaSeleccionada.ajustesSaldo}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-medium">Históricos auditados</span>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-zinc-200 bg-white shadow-2xs">
                  <CardContent className="p-3.5 text-center">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block">Disfrutados</span>
                    <span className="text-xl font-extrabold text-zinc-700 mt-1 block">
                      {fichaSeleccionada.diasDisfrutados}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-medium">
                      +{fichaSeleccionada.diasReservadosPendientes} reservados
                    </span>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-emerald-200 bg-emerald-50/30 shadow-2xs">
                  <CardContent className="p-3.5 text-center">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Saldo Disponible</span>
                    <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">
                      {fichaSeleccionada.saldoDisponible}
                    </span>
                    <span className="text-[9px] text-emerald-700 font-medium">Días hábiles</span>
                  </CardContent>
                </Card>
              </div>

              {/* Advertencia Art. 81 */}
              {fichaSeleccionada.alertaPlazoArt81 && (
                <div className="p-3.5 rounded-2xl border border-amber-300 bg-amber-50 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Aviso Legal — Plazo Art. 81 LFT Vencido</span>
                    <p className="text-[11px] mt-0.5 leading-relaxed">{fichaSeleccionada.motivoAlertaArt81}</p>
                  </div>
                </div>
              )}

              {/* Próximo Aniversario e Información Informativa */}
              <Card className="rounded-2xl border-zinc-200/90 bg-white shadow-2xs">
                <CardHeader className="pb-2 pt-4 px-4 border-b border-zinc-100">
                  <CardTitle className="text-xs font-bold text-zinc-900">
                    Próximo Aniversario y Prestaciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600">Fecha de próximo aniversario:</span>
                    <span className="font-bold text-zinc-900 font-mono">
                      {fichaSeleccionada.fechaProximoAniversario} ({fichaSeleccionada.diasParaProximoAniversario} días restantes)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600">Días que se generarán al cumplir aniversario:</span>
                    <span className="font-bold text-emerald-600">
                      +{calcularDiasPorAnioServicioLFT(fichaSeleccionada.aniosServicioCumplidos + 1)} días hábiles
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <span className="text-zinc-600">Prima Vacacional Informativa (Art. 80 LFT):</span>
                    <Badge variant="outline" className="text-[11px] font-mono border-zinc-300">
                      25% sobre salario del periodo
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Simulador de Días Hábiles */}
              <Card className="rounded-2xl border-zinc-200/90 bg-white shadow-2xs">
                <CardHeader className="pb-2 pt-4 px-4 border-b border-zinc-100">
                  <div className="flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-zinc-600" />
                    <CardTitle className="text-xs font-bold text-zinc-900">
                      Simulador de Descuento de Vacaciones
                    </CardTitle>
                  </div>
                  <CardDescription className="text-[10px]">
                    Calcula los días efectivos laborables (excluyendo domingos y feriados obligatorios de la LFT).
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <form onSubmit={handleSimular} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                      <div className="min-w-0">
                        <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Fecha Inicio</label>
                        <input
                          type="date"
                          required
                          value={simFechaInicio}
                          onChange={(e) => setSimFechaInicio(e.target.value)}
                          className="w-full min-w-0 rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Fecha Fin</label>
                        <input
                          type="date"
                          required
                          min={simFechaInicio}
                          value={simFechaFin}
                          onChange={(e) => setSimFechaFin(e.target.value)}
                          className="w-full min-w-0 rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isSimulating}
                        className="rounded-xl text-xs shadow-2xs"
                      >
                        {isSimulating ? "Calculando..." : "Simular Días Hábiles"}
                      </Button>

                      {simResultado && (
                        <div className="text-right text-xs">
                          <span className="font-extrabold text-zinc-900 text-sm">
                            {simResultado.diasHabiles} días a descontar
                          </span>
                          <span className="text-[10px] text-zinc-500 block">
                            ({simResultado.diasNaturales} naturales · {simResultado.domingosExcluidos} descansos excluidos)
                          </span>
                        </div>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Historial de Ajustes */}
              <Card className="rounded-2xl border-zinc-200/90 bg-white shadow-2xs">
                <CardHeader className="pb-2 pt-4 px-4 border-b border-zinc-100">
                  <div className="flex items-center gap-1.5">
                    <History className="h-4 w-4 text-zinc-600" />
                    <CardTitle className="text-xs font-bold text-zinc-900">
                      Bitácora de Ajustes y Cargas Históricas
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {fichaSeleccionada.ajustes.length === 0 ? (
                    <div className="py-4 text-center text-zinc-400 text-xs">
                      No hay ajustes históricos registrados para este empleado.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fichaSeleccionada.ajustes.map((aj) => (
                        <div
                          key={aj.id}
                          className="p-2.5 rounded-xl border border-zinc-100 bg-[#F9F9FB] text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-zinc-900 block">{aj.tipo}</span>
                            <span className="text-[10px] text-zinc-500">{aj.motivo}</span>
                          </div>
                          <span className="font-extrabold text-blue-600 font-mono">
                            {aj.tipo === "AJUSTE_NEGATIVO" ? `-${aj.dias}` : `+${aj.dias}`} días
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="rounded-2xl border-zinc-200 p-8 text-center text-zinc-400 text-xs">
              Selecciona un trabajador para consultar su ficha vacacional.
            </Card>
          )}
        </div>
      </div>

      {/* Modal de Carga Histórica / Ajuste */}
      {modalAjuste && fichaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 bg-[#FAFAFC]">
              <h3 className="text-xs font-bold text-zinc-900">Registrar Ajuste Vacacional</h3>
              <button
                type="button"
                onClick={() => setModalAjuste(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarAjuste} className="p-5 space-y-3.5 text-xs">
              <p className="text-zinc-600">
                Trabajador: <strong>{fichaSeleccionada.nombreCompleto}</strong> (#{fichaSeleccionada.numeroEmpleado})
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 block">Tipo de Movimiento</label>
                <select
                  value={tipoAjuste}
                  onChange={(e) => setTipoAjuste(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-1.5 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                >
                  <option value="CARGA_HISTORICA">Carga Histórica Inicial (Previa a 2026)</option>
                  <option value="AJUSTE_POSITIVO">Ajuste Positivo (+ Días)</option>
                  <option value="AJUSTE_NEGATIVO">Ajuste Negativo (- Días)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 block">Cantidad de Días</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  required
                  value={diasAjuste}
                  onChange={(e) => setDiasAjuste(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] px-3 py-1.5 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700 block">Justificación Auditada (Mín. 5 caracteres)</label>
                <textarea
                  required
                  rows={3}
                  value={motivoAjuste}
                  onChange={(e) => setMotivoAjuste(e.target.value)}
                  placeholder="Explica la causa del ajuste o documento fuente..."
                  className="w-full rounded-xl border border-zinc-200 bg-[#F9F9FB] p-2.5 text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalAjuste(false)}
                  disabled={isSavingAjuste}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingAjuste}
                  className="rounded-xl text-xs shadow-xs"
                >
                  {isSavingAjuste ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Ajuste"
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
