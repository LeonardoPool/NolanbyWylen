"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  FileText,
  Download,
  Calendar,
  Users,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock,
  Loader2,
  UserCheck,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { notify } from "@/lib/feedback/toast";
import {
  obtenerReporteInspeccionSTPS,
  generarExcelReporteAsistencias,
  type RespuestaReporteInspeccion,
  type ReporteEmpleadoLFT,
} from "../actions";
import type { EmpleadoRow } from "@/features/empleados/actions";

interface ReportesVistaProps {
  reporteInicial: RespuestaReporteInspeccion;
  empleados: EmpleadoRow[];
  fechaInicioDefault: string;
  fechaFinDefault: string;
}

export function ReportesVista({
  reporteInicial,
  empleados,
  fechaInicioDefault,
  fechaFinDefault,
}: ReportesVistaProps) {
  const [reporte, setReporte] = useState<RespuestaReporteInspeccion>(reporteInicial);
  const [fechaInicio, setFechaInicio] = useState(fechaInicioDefault);
  const [fechaFin, setFechaFin] = useState(fechaFinDefault);
  const [empleadoId, setEmpleadoId] = useState("todos");
  const [isPending, startTransition] = useTransition();
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  function aplicarPeriodoRapido(tipo: "quincena_actual" | "mes_actual" | "quincena_anterior" | "mes_anterior") {
    const ahora = new Date();
    let ini = new Date(ahora);
    let fin = new Date(ahora);

    if (tipo === "quincena_actual") {
      const dia = ahora.getDate();
      if (dia <= 15) {
        ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        fin = new Date(ahora.getFullYear(), ahora.getMonth(), 15);
      } else {
        ini = new Date(ahora.getFullYear(), ahora.getMonth(), 16);
        fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
      }
    } else if (tipo === "mes_actual") {
      ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
    } else if (tipo === "quincena_anterior") {
      const dia = ahora.getDate();
      if (dia <= 15) {
        // Segunda quincena del mes anterior
        ini = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 16);
        fin = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
      } else {
        // Primera quincena del mes actual
        ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        fin = new Date(ahora.getFullYear(), ahora.getMonth(), 15);
      }
    } else if (tipo === "mes_anterior") {
      ini = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      fin = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
    }

    const iniStr = ini.toISOString().slice(0, 10);
    const finStr = fin.toISOString().slice(0, 10);
    setFechaInicio(iniStr);
    setFechaFin(finStr);
    consultar(iniStr, finStr, empleadoId);
  }

  function consultar(ini: string, fn: string, emp: string) {
    startTransition(async () => {
      const res = await obtenerReporteInspeccionSTPS({
        fechaInicio: ini,
        fechaFin: fn,
        empleadoId: emp,
      });

      if (res.success) {
        setReporte(res);
      } else {
        notify.error("Error al generar", res.error);
      }
    });
  }

  async function handleExportarExcel() {
    try {
      setIsExportingExcel(true);
      const res = await generarExcelReporteAsistencias({
        fechaInicio,
        fechaFin,
        empleadoId,
      });

      if (!res.success || !res.base64) {
        notify.error("Error al exportar", res.error || "No se pudo generar el archivo Excel.");
        return;
      }

      // Decodificar Base64 a ArrayBuffer para Blob nativo XLSX
      const binaryString = atob(res.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.nombreArchivo || `NOLAN_Reporte_Asistencias_${fechaInicio}_${fechaFin}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const resumen = res.resumen;
      notify.success(
        "Excel Corporativo Generado",
        `${resumen?.totalJornadas || 0} jornadas y ${resumen?.totalMarcajes || 0} marcajes incluidos.`
      );

      if (resumen && (resumen.totalConFoto > 0 || resumen.totalBiometricos > 0)) {
        notify.info(
          "Trazabilidad de Evidencias",
          `${resumen.totalConFoto} fotos selfie y ${resumen.totalBiometricos} registros biométricos verificados.`
        );
      }
    } catch (err) {
      notify.error("Error inesperado", err instanceof Error ? err.message : "Falla al procesar Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  }

  // Exportar a CSV con BOM UTF-8 para Excel
  function exportarCSV() {
    if (!reporte.reportesEmpleados || reporte.reportesEmpleados.length === 0) {
      notify.warning("Sin datos", "No hay registros para exportar en este período.");
      return;
    }

    const filas: string[] = [
      `"REPORTE OFICIAL DE ASISTENCIA LFT - SERVICIO MECÁNICO LÓPEZ"`,
      `"Período: ${reporte.fechaInicio} al ${reporte.fechaFin}"`,
      `"Generado: ${new Date().toLocaleString("es-MX")}"`,
      "",
      `"No. Empleado","Nombre Completo","CURP","RFC","NSS","Puesto","Fecha","1. Entrada","2. Salida Comida","3. Regreso Comida","4. Salida Final","Horas Ordinarias","Horas Dobles","Horas Triples","Retardo (min)","Estado"`,
    ];

    for (const r of reporte.reportesEmpleados) {
      for (const j of r.jornadas) {
        const ent = j.entrada ? new Date(j.entrada.fechaHora).toLocaleTimeString("es-MX") : "";
        const sc = j.inicioDescanso ? new Date(j.inicioDescanso.fechaHora).toLocaleTimeString("es-MX") : "";
        const rc = j.finDescanso ? new Date(j.finDescanso.fechaHora).toLocaleTimeString("es-MX") : "";
        const sal = j.salida ? new Date(j.salida.fechaHora).toLocaleTimeString("es-MX") : "";

        filas.push(
          `"${r.empleado.numero_empleado}","${r.empleado.nombre} ${r.empleado.apellidos}","${
            r.empleado.curp || ""
          }","${r.empleado.rfc || ""}","${r.empleado.nss || ""}","${r.empleado.puesto}","${
            j.fecha
          }","${ent}","${sc}","${rc}","${sal}","${j.horasOrdinarias}","${j.horasExtraDobles}","${
            j.horasExtraTriples
          }","${j.minutosRetardo}","${j.estadoJornada}"`
        );
      }
    }

    const csvContent = "\uFEFF" + filas.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_Asistencias_LFT_${reporte.fechaInicio}_${reporte.fechaFin}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify.success("Descarga iniciada", "Archivo CSV generado correctamente para Excel.");
  }

  function handleImprimir() {
    window.print();
  }

  function formatearHora(isoStr?: string | null) {
    if (!isoStr) return "--:--";
    return new Date(isoStr).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  return (
    <div className="space-y-6">
      {/* Header - Oculto en impresión */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            Generador de Reportes e Inspección STPS
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </h1>
          <p className="text-xs text-zinc-500">
            Evidencia defendible conforme al Art. 132 fracción XXXIV de la Ley Federal del Trabajo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleExportarExcel}
            disabled={isExportingExcel}
            className="rounded-xl text-xs bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm font-semibold h-8"
          >
            {isExportingExcel ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Generando Excel...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-100" />
                Descargar Excel (.xlsx)
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportarCSV}
            className="rounded-xl text-xs text-zinc-600 hover:text-zinc-900 border-zinc-200 shadow-2xs h-8"
            title="Exportar archivo de texto plano CSV"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
            CSV
          </Button>
          <Button
            size="sm"
            onClick={handleImprimir}
            className="rounded-xl text-xs bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm h-8"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Imprimir Hoja STPS
          </Button>
        </div>
      </div>

      {/* Criterios y Filtros - Oculto en impresión */}
      <Card className="rounded-2xl border-zinc-200 shadow-2xs print:hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-bold text-zinc-900">Criterios de Inspección Laboral</CardTitle>
          <CardDescription className="text-[11px] text-zinc-500">
            Define el período legal y el personal a incluir en la auditoría.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Rango de fechas */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700 block">Rango Predefinido</label>
              <select
                onChange={(e) => aplicarPeriodoRapido(e.target.value as any)}
                defaultValue="quincena_actual"
                className="w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
              >
                <option value="quincena_actual">Quincena en curso</option>
                <option value="mes_actual">Mes en curso</option>
                <option value="quincena_anterior">Quincena anterior</option>
                <option value="mes_anterior">Mes anterior</option>
              </select>
            </div>

            {/* Fechas personalizadas */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700 block">Fechas Específicas</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 focus:outline-none"
                />
                <span className="text-zinc-400 text-xs">al</span>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Empleado */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700 block">Personal a Auditar</label>
              <select
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
              >
                <option value="todos">Todo el personal activo ({empleados.length})</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.numero_empleado} — {emp.nombre} {emp.apellidos}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-zinc-100">
            <Button
              size="sm"
              onClick={() => consultar(fechaInicio, fechaFin, empleadoId)}
              disabled={isPending}
              className="rounded-xl text-xs h-8 px-4"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Calculando Horas LFT...
                </>
              ) : (
                "Generar Reporte Consolidado"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas de Totales Generales - Oculto en impresión */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 print:hidden">
        <Card className="rounded-2xl border-zinc-200 p-3 shadow-2xs">
          <p className="text-[11px] text-zinc-500 font-medium">Jornadas Totales</p>
          <p className="text-xl font-bold text-zinc-900 mt-1">{reporte.totalesGenerales.totalDias}</p>
        </Card>
        <Card className="rounded-2xl border-zinc-200 p-3 shadow-2xs">
          <p className="text-[11px] text-blue-700 font-medium">Horas Ordinarias</p>
          <p className="text-xl font-bold text-blue-950 mt-1">{reporte.totalesGenerales.totalOrdinarias}h</p>
        </Card>
        <Card className="rounded-2xl border-zinc-200 p-3 shadow-2xs">
          <p className="text-[11px] text-amber-700 font-medium">Horas Extras Dobles</p>
          <p className="text-xl font-bold text-amber-900 mt-1">{reporte.totalesGenerales.totalDobles}h</p>
        </Card>
        <Card className="rounded-2xl border-zinc-200 p-3 shadow-2xs">
          <p className="text-[11px] text-rose-700 font-medium">Horas Extras Triples</p>
          <p className="text-xl font-bold text-rose-900 mt-1">{reporte.totalesGenerales.totalTriples}h</p>
        </Card>
        <Card className="rounded-2xl border-zinc-200 p-3 shadow-2xs">
          <p className="text-[11px] text-zinc-500 font-medium">Retardos en Período</p>
          <p className="text-xl font-bold text-zinc-900 mt-1">{reporte.totalesGenerales.totalRetardos}</p>
        </Card>
      </div>

      {/* DOCUMENTO OFICIAL DE INSPECCIÓN (Visible en pantalla y optimizado para IMPRESIÓN/PDF) */}
      <div className="space-y-8 bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Encabezado Institucional del Taller */}
        <div className="border-b-2 border-zinc-900 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 block">
              Registro Electrónico Laboral Obligatorio
            </span>
            <h2 className="text-lg font-black tracking-tight text-zinc-950 uppercase">
              {reporte.taller.nombre || "Servicio Mecánico López"}
            </h2>
            <p className="text-xs text-zinc-600 mt-0.5">
              {reporte.taller.direccion || "Av. Principal del Taller"}
            </p>
          </div>
          <div className="text-right sm:text-right text-xs text-zinc-600 space-y-0.5">
            <p className="font-bold text-zinc-900">Expediente de Inspección STPS</p>
            <p className="text-[11px]">
              Período: <strong>{reporte.fechaInicio}</strong> al <strong>{reporte.fechaFin}</strong>
            </p>
            <p className="text-[10px] text-zinc-400">
              LFT Art. 132 fr. XXXIV (DOF 1-may-2026)
            </p>
          </div>
        </div>

        {reporte.reportesEmpleados.length === 0 ? (
          <div className="py-12 text-center text-zinc-400">
            <FileText className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
            <p className="text-xs font-semibold text-zinc-700">Sin registros para el período seleccionado</p>
          </div>
        ) : (
          reporte.reportesEmpleados.map((item, idx) => (
            <div
              key={item.empleado.id || idx}
              className="space-y-4 pt-4 first:pt-0 print:break-before-page border-b border-zinc-200/80 pb-6 last:border-none"
            >
              {/* Ficha Legal del Empleado (RFC, CURP, NSS requeridos por la autoridad) */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 text-xs text-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Trabajador</span>
                  <span className="font-bold text-zinc-900">
                    {item.empleado.nombre} {item.empleado.apellidos}
                  </span>
                  <span className="block text-[10px] text-zinc-500">{item.empleado.numero_empleado}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Puesto Asignado</span>
                  <span className="font-medium text-zinc-800">{item.empleado.puesto}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold block">CURP / RFC</span>
                  <span className="font-mono text-[11px] font-semibold text-zinc-900 block">
                    {item.empleado.curp || "NO REGISTRADO"}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500 block">
                    RFC: {item.empleado.rfc || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold block">NSS (Seguridad Social)</span>
                  <span className="font-mono text-[11px] font-semibold text-zinc-900 block">
                    {item.empleado.nss || "NO REGISTRADO"}
                  </span>
                </div>
              </div>

              {/* Tabla Detallada con las 4 Marcas Diarias */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-zinc-200">
                  <thead>
                    <tr className="bg-zinc-100 text-zinc-700 font-bold text-[10px] uppercase border-b border-zinc-200">
                      <th className="p-2 border-r border-zinc-200">Fecha</th>
                      <th className="p-2 border-r border-zinc-200">1. Entrada</th>
                      <th className="p-2 border-r border-zinc-200">2. Salida Comida</th>
                      <th className="p-2 border-r border-zinc-200">3. Regreso Comida</th>
                      <th className="p-2 border-r border-zinc-200">4. Salida Final</th>
                      <th className="p-2 border-r border-zinc-200 text-right">Efectivas</th>
                      <th className="p-2 border-r border-zinc-200 text-right">Ext. Dobles</th>
                      <th className="p-2 border-r border-zinc-200 text-right">Ext. Triples</th>
                      <th className="p-2">Método de Registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-mono text-[11px]">
                    {item.jornadas.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-4 text-center text-zinc-400 font-sans">
                          Sin marcajes registrados en este rango de fechas.
                        </td>
                      </tr>
                    ) : (
                      item.jornadas.map((j, jIdx) => (
                        <tr key={jIdx} className="hover:bg-zinc-50/50">
                          <td className="p-2 font-sans font-medium text-zinc-900 border-r border-zinc-200">
                            {j.fecha}
                          </td>
                          <td className="p-2 border-r border-zinc-200 font-semibold text-zinc-800">
                            {formatearHora(j.entrada?.fechaHora)}
                          </td>
                          <td className="p-2 border-r border-zinc-200 text-zinc-600">
                            {formatearHora(j.inicioDescanso?.fechaHora)}
                          </td>
                          <td className="p-2 border-r border-zinc-200 text-zinc-600">
                            {formatearHora(j.finDescanso?.fechaHora)}
                          </td>
                          <td className="p-2 border-r border-zinc-200 font-semibold text-zinc-800">
                            {formatearHora(j.salida?.fechaHora)}
                          </td>
                          <td className="p-2 border-r border-zinc-200 text-right font-bold text-blue-900">
                            {j.horasOrdinarias}h
                          </td>
                          <td className="p-2 border-r border-zinc-200 text-right font-semibold text-amber-800">
                            {j.horasExtraDobles > 0 ? `${j.horasExtraDobles}h` : "—"}
                          </td>
                          <td className="p-2 border-r border-zinc-200 text-right font-semibold text-rose-800">
                            {j.horasExtraTriples > 0 ? `${j.horasExtraTriples}h` : "—"}
                          </td>
                          <td className="p-2 font-sans text-[10px] text-zinc-600">
                            {j.entrada?.metodoRegistro === "WEB"
                              ? "WEB (GPS / Selfie)"
                              : j.entrada?.metodoRegistro === "DISPOSITIVO"
                              ? "Biométrico Huella"
                              : j.entrada?.metodoRegistro || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {/* Fila de Totales del Empleado */}
                  <tfoot className="bg-zinc-100/80 font-sans text-xs font-bold border-t-2 border-zinc-300">
                    <tr>
                      <td colSpan={5} className="p-2 text-right uppercase text-zinc-600">
                        Totales Período:
                      </td>
                      <td className="p-2 text-right text-blue-950 font-mono">
                        {item.resumen.horasOrdinariasTotales} hrs
                      </td>
                      <td className="p-2 text-right text-amber-900 font-mono">
                        {item.resumen.horasExtraDoblesTotales} hrs
                      </td>
                      <td className="p-2 text-right text-rose-900 font-mono">
                        {item.resumen.horasExtraTriplesTotales} hrs
                      </td>
                      <td className="p-2 text-zinc-500 font-normal text-[10px]">
                        {item.resumen.diasLaborados} días ({item.resumen.totalRetardos} retardos)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Bloque Legal de Firmas para Constituir "Prueba Plena" ante la Autoridad (LFT Art. 132 fr. XXXIV) */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs text-zinc-700">
                <div className="space-y-1">
                  <div className="border-b border-zinc-400 w-48 sm:w-64 mx-auto mb-1 h-12" />
                  <p className="font-bold text-zinc-900">
                    {item.empleado.nombre} {item.empleado.apellidos}
                  </p>
                  <p className="text-[10px] text-zinc-500">Firma de Conformidad del Trabajador</p>
                </div>
                <div className="space-y-1">
                  <div className="border-b border-zinc-400 w-48 sm:w-64 mx-auto mb-1 h-12" />
                  <p className="font-bold text-zinc-900">Servicio Mecánico López</p>
                  <p className="text-[10px] text-zinc-500">Firma del Patrón / Representante Legal</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
