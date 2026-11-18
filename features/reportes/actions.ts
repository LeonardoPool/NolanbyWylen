"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";
import {
  procesarJornadaDiaria,
  consolidarPeriodoLFT,
  type EventoAsistenciaSimple,
  type JornadaDiariaCalculada,
  type ResumenSemanalLFT,
} from "@/lib/lft/calculo-horas";
import { obtenerConfiguracionTaller } from "@/features/configuracion/actions";
import { generarLibroExcelAsistencias, type MarcajeDetalladoExcel, type ModificacionAuditoriaExcel } from "./services/generador-excel";
import { obtenerFechaHoyMerida } from "@/lib/utils/fechas-laborales";

export interface ReporteEmpleadoLFT {
  empleado: {
    id: string;
    numero_empleado: string;
    nombre: string;
    apellidos: string;
    puesto: string;
    curp: string | null;
    rfc: string | null;
    nss: string | null;
  };
  jornadas: JornadaDiariaCalculada[];
  resumen: ResumenSemanalLFT;
}

export interface RespuestaReporteInspeccion {
  success: boolean;
  taller: {
    nombre: string;
    direccion: string;
  };
  fechaInicio: string;
  fechaFin: string;
  reportesEmpleados: ReporteEmpleadoLFT[];
  totalesGenerales: {
    totalDias: number;
    totalOrdinarias: number;
    totalDobles: number;
    totalTriples: number;
    totalRetardos: number;
  };
  error?: string;
}

/**
 * Genera la compilación para la Hoja de Inspección Oficial STPS conforme a la LFT.
 */
export async function obtenerReporteInspeccionSTPS(filtros: {
  fechaInicio: string;
  fechaFin: string;
  empleadoId?: string;
  empleadosIds?: string[];
}): Promise<RespuestaReporteInspeccion> {
  const { fechaInicio, fechaFin, empleadoId, empleadosIds } = filtros;
  const adminClient = createAdminClient();

  try {
    const { configuracion: configTaller } = await obtenerConfiguracionTaller();

    // 1. Obtener empleados
    let empQuery = adminClient.from("empleados").select("*").eq("activo", true);
    if (empleadosIds && empleadosIds.length > 0 && !empleadosIds.includes("todos")) {
      empQuery = empQuery.in("id", empleadosIds);
    } else if (empleadoId && empleadoId !== "todos") {
      empQuery = empQuery.eq("id", empleadoId);
    }
    const { data: empleados, error: empError } = await empQuery.order("apellidos", { ascending: true });

    if (empError || !empleados || empleados.length === 0) {
      return {
        success: false,
        taller: { nombre: configTaller.nombre_taller, direccion: configTaller.direccion_taller },
        fechaInicio,
        fechaFin,
        reportesEmpleados: [],
        totalesGenerales: { totalDias: 0, totalOrdinarias: 0, totalDobles: 0, totalTriples: 0, totalRetardos: 0 },
        error: "No se encontraron empleados activos para el reporte.",
      };
    }

    // 2. Obtener asistencias del período
    const empIds = empleados.map((e) => e.id);
    const { data: asistencias, error: asisError } = await adminClient
      .from("asistencias")
      .select("*")
      .in("empleado_id", empIds)
      .gte("fecha_hora", `${fechaInicio}T00:00:00.000Z`)
      .lte("fecha_hora", `${fechaFin}T23:59:59.999Z`)
      .order("fecha_hora", { ascending: true });

    if (asisError) {
      return {
        success: false,
        taller: { nombre: configTaller.nombre_taller, direccion: configTaller.direccion_taller },
        fechaInicio,
        fechaFin,
        reportesEmpleados: [],
        totalesGenerales: { totalDias: 0, totalOrdinarias: 0, totalDobles: 0, totalTriples: 0, totalRetardos: 0 },
        error: asisError.message,
      };
    }

    // Mapear eventos por empleado y día
    const mapaEventos = new Map<string, Map<string, EventoAsistenciaSimple[]>>();
    for (const a of asistencias || []) {
      const eId = a.empleado_id;
      const fechaDia = a.fecha_hora.slice(0, 10);

      if (!mapaEventos.has(eId)) {
        mapaEventos.set(eId, new Map());
      }
      const mapaDias = mapaEventos.get(eId)!;
      if (!mapaDias.has(fechaDia)) {
        mapaDias.set(fechaDia, []);
      }

      const meta = a.metadatos_origen as any;
      mapaDias.get(fechaDia)!.push({
        tipoEvento: a.tipo_evento_original as any,
        fechaHora: a.fecha_hora,
        metodoRegistro: a.metodo_registro,
        fotoUrl: meta?.foto_verificacion || null,
        motivoAjuste: meta?.motivo_ajuste || a.justificacion || null,
      });
    }

    let totDias = 0;
    let totOrd = 0;
    let totDob = 0;
    let totTri = 0;
    let totRet = 0;

    const reportesEmpleados: ReporteEmpleadoLFT[] = [];

    for (const emp of empleados) {
      const mapaDias = mapaEventos.get(emp.id) || new Map();
      const jornadasSinConsolidar: JornadaDiariaCalculada[] = [];

      mapaDias.forEach((eventos, fechaDia) => {
        const j = procesarJornadaDiaria(eventos, fechaDia);
        jornadasSinConsolidar.push(j);
      });

      const { jornadasAjustadas, resumen } = consolidarPeriodoLFT(jornadasSinConsolidar);

      totDias += resumen.diasLaborados;
      totOrd += resumen.horasOrdinariasTotales;
      totDob += resumen.horasExtraDoblesTotales;
      totTri += resumen.horasExtraTriplesTotales;
      totRet += resumen.totalRetardos;

      reportesEmpleados.push({
        empleado: {
          id: emp.id,
          numero_empleado: emp.numero_empleado,
          nombre: emp.nombre,
          apellidos: emp.apellidos,
          puesto: emp.puesto,
          curp: emp.curp,
          rfc: emp.rfc,
          nss: emp.nss,
        },
        jornadas: jornadasAjustadas.sort(
          (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        ),
        resumen,
      });
    }

    return {
      success: true,
      taller: {
        nombre: configTaller.nombre_taller,
        direccion: configTaller.direccion_taller,
      },
      fechaInicio,
      fechaFin,
      reportesEmpleados,
      totalesGenerales: {
        totalDias: totDias,
        totalOrdinarias: parseFloat(totOrd.toFixed(2)),
        totalDobles: parseFloat(totDob.toFixed(2)),
        totalTriples: parseFloat(totTri.toFixed(2)),
        totalRetardos: totRet,
      },
    };
  } catch (err) {
    return {
      success: false,
      taller: { nombre: "Servicio Mecánico López", direccion: "" },
      fechaInicio,
      fechaFin,
      reportesEmpleados: [],
      totalesGenerales: { totalDias: 0, totalOrdinarias: 0, totalDobles: 0, totalTriples: 0, totalRetardos: 0 },
      error: err instanceof Error ? err.message : "Error al generar reporte.",
    };
  }
}

export interface RespuestaExportacionExcel {
  success: boolean;
  base64?: string;
  nombreArchivo?: string;
  resumen?: {
    totalEmpleados: number;
    totalJornadas: number;
    totalMarcajes: number;
    totalConFoto: number;
    totalBiometricos: number;
    totalSinFoto: number;
  };
  error?: string;
}

/**
 * Server Action para generar y descargar el reporte ejecutivo en formato Excel (.xlsx) nativo
 * estructurado en 3 hojas (ASISTENCIAS, EVIDENCIA DE MARCAJES, HISTORIAL DE MODIFICACIONES)
 * conservando el 100% de los datos y consultas originales sin alterar la lógica de negocio.
 */
export async function generarExcelReporteAsistencias(filtros: {
  fechaInicio: string;
  fechaFin: string;
  empleadoId?: string;
  empleadosIds?: string[];
}): Promise<RespuestaExportacionExcel> {
  try {
    const { fechaInicio, fechaFin } = filtros;
    const adminClient = createAdminClient();

    // 1. Obtener la información consolidada LFT usando exactamente la misma consulta existente
    const reporteRes = await obtenerReporteInspeccionSTPS(filtros);
    if (!reporteRes.success) {
      return { success: false, error: reporteRes.error || "No se pudo obtener la información de asistencias." };
    }

    if (reporteRes.reportesEmpleados.length === 0) {
      return { success: false, error: "No se encontraron empleados o jornadas para el período seleccionado." };
    }

    // 2. Obtener los marcajes individuales exactos del período para la Hoja de Evidencias y Trazabilidad
    const empIds = reporteRes.reportesEmpleados.map((r) => r.empleado.id);
    const empMap = new Map(reporteRes.reportesEmpleados.map((r) => [r.empleado.id, r.empleado]));

    const { data: asistenciasRaw, error: asisError } = await adminClient
      .from("asistencias")
      .select("*")
      .in("empleado_id", empIds)
      .gte("fecha_hora", `${fechaInicio}T00:00:00.000Z`)
      .lte("fecha_hora", `${fechaFin}T23:59:59.999Z`)
      .order("fecha_hora", { ascending: true });

    if (asisError) {
      return { success: false, error: `Error al consultar marcajes de evidencia: ${asisError.message}` };
    }

    const marcajesDetallados: MarcajeDetalladoExcel[] = [];
    const modificaciones: ModificacionAuditoriaExcel[] = [];

    for (const a of asistenciasRaw || []) {
      const emp = empMap.get(a.empleado_id);
      const meta = a.metadatos_origen as any;
      const tieneFoto = Boolean(meta?.foto_verificacion);
      const esBiometrico = a.metodo_registro === "DISPOSITIVO";

      let metodoNombre = "—";
      if (a.metodo_registro === "WEB") metodoNombre = "WEB (GPS / Selfie)";
      else if (a.metodo_registro === "DISPOSITIVO") metodoNombre = "Biométrico Huella (MB10V)";
      else if (a.metodo_registro === "MANUAL") metodoNombre = "Ajuste Manual";
      else if (a.metodo_registro) metodoNombre = a.metodo_registro;

      let estadoEvidencia = "Sin Evidencia Fotográfica (PIN / GPS)";
      if (tieneFoto) estadoEvidencia = "Evidencia Fotográfica Verificada (Selfie)";
      else if (esBiometrico) estadoEvidencia = "Biometría Dactilar Verificada (Terminal MB10V)";

      let detalleUbicacion = "Taller Matriz";
      if (meta?.distancia_metros !== undefined) {
        detalleUbicacion = `${Math.round(meta.distancia_metros)}m del taller`;
      }

      const fechaDia = obtenerFechaHoyMerida(a.fecha_hora);
      let horaTexto = "--:--";
      try {
        horaTexto = new Date(a.fecha_hora).toLocaleTimeString("es-MX", {
          timeZone: "America/Merida",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
      } catch {
        horaTexto = "--:--";
      }

      marcajesDetallados.push({
        id: a.id,
        empleadoId: a.empleado_id,
        numeroEmpleado: emp?.numero_empleado || "—",
        nombreCompleto: emp ? `${emp.nombre} ${emp.apellidos}` : "Desconocido",
        puesto: emp?.puesto || "—",
        fecha: fechaDia,
        hora: horaTexto,
        tipoEvento: a.tipo_evento_original,
        metodoRegistro: metodoNombre,
        estado: a.estado,
        tieneFoto,
        esBiometrico,
        estadoEvidencia,
        detalleUbicacion,
        hashEvento: a.hash_evento,
        fechaHoraOriginal: a.fecha_hora,
        fechaHoraCorregida: a.fecha_hora_corregida,
        tipoEventoCorregido: a.tipo_evento_corregido,
        justificacion: a.justificacion || meta?.motivo_ajuste || null,
        fechaModificacion: a.fecha_modificacion,
      });

      // Si el registro fue corregido, justificado o tiene auditoría
      if (a.estado !== "REGISTRADA" || a.fecha_hora_corregida || a.tipo_evento_corregido || a.justificacion) {
        modificaciones.push({
          id: a.id,
          numeroEmpleado: emp?.numero_empleado || "—",
          nombreCompleto: emp ? `${emp.nombre} ${emp.apellidos}` : "Desconocido",
          fechaOriginal: a.fecha_hora,
          tipoEventoOriginal: a.tipo_evento_original,
          estado: a.estado,
          fechaCorregida: a.fecha_hora_corregida,
          tipoCorregido: a.tipo_evento_corregido,
          justificacion: a.justificacion || meta?.motivo_ajuste || "Sin justificación registrada",
          fechaModificacion: a.fecha_modificacion || a.fecha_creacion,
        });
      }
    }

    const fechaEmision = new Date().toLocaleString("es-MX", {
      timeZone: "America/Merida",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const bufferExcel = await generarLibroExcelAsistencias({
      taller: reporteRes.taller,
      fechaInicio: reporteRes.fechaInicio,
      fechaFin: reporteRes.fechaFin,
      fechaEmision,
      reportesEmpleados: reporteRes.reportesEmpleados,
      totalesGenerales: reporteRes.totalesGenerales,
      marcajesDetallados,
      modificaciones,
    });

    const totalConFoto = marcajesDetallados.filter((m) => m.tieneFoto).length;
    const totalBiometricos = marcajesDetallados.filter((m) => m.esBiometrico).length;
    const totalSinFoto = marcajesDetallados.length - totalConFoto - totalBiometricos;
    const nombreArchivo = `NOLAN_Reporte_Asistencias_${fechaInicio}_${fechaFin}.xlsx`;

    return {
      success: true,
      base64: bufferExcel.toString("base64"),
      nombreArchivo,
      resumen: {
        totalEmpleados: reporteRes.reportesEmpleados.length,
        totalJornadas: reporteRes.totalesGenerales.totalDias,
        totalMarcajes: marcajesDetallados.length,
        totalConFoto,
        totalBiometricos,
        totalSinFoto,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado al generar el archivo Excel.",
    };
  }
}
