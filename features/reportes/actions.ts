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
}): Promise<RespuestaReporteInspeccion> {
  const { fechaInicio, fechaFin, empleadoId } = filtros;
  const adminClient = createAdminClient();

  try {
    const { configuracion: configTaller } = await obtenerConfiguracionTaller();

    // 1. Obtener empleados
    let empQuery = adminClient.from("empleados").select("*").eq("activo", true);
    if (empleadoId && empleadoId !== "todos") {
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
