"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database.types";
import {
  procesarJornadaDiaria,
  consolidarPeriodoLFT,
  type EventoAsistenciaSimple,
  type JornadaDiariaCalculada,
  type ResumenSemanalLFT,
} from "@/lib/lft/calculo-horas";

export type { ResumenSemanalLFT };

export type AsistenciaRow = Database["public"]["Tables"]["asistencias"]["Row"];
export type EmpleadoRow = Database["public"]["Tables"]["empleados"]["Row"];

export interface JornadaEmpleadoCompleta extends JornadaDiariaCalculada {
  empleado: {
    id: string;
    numero_empleado: string;
    nombre: string;
    apellidos: string;
    puesto: string;
  };
}

export interface RespuestaAsistenciasPeriodo {
  success: boolean;
  jornadas: JornadaEmpleadoCompleta[];
  resumen: ResumenSemanalLFT;
  error?: string;
}

/**
 * Consulta y calcula las jornadas de asistencia agrupadas por día y trabajador
 * conforme a la normativa laboral (LFT).
 */
export async function obtenerAsistenciasPeriodo(filtros: {
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  empleadoId?: string;
}): Promise<RespuestaAsistenciasPeriodo> {
  const { fechaInicio, fechaFin, empleadoId } = filtros;
  const adminClient = createAdminClient();

  try {
    let query = adminClient
      .from("asistencias")
      .select(`
        id,
        empleado_id,
        fecha_hora,
        tipo_evento_original,
        metodo_registro,
        metadatos_origen,
        justificacion,
        empleados (
          id,
          numero_empleado,
          nombre,
          apellidos,
          puesto,
          activo
        )
      `)
      .gte("fecha_hora", `${fechaInicio}T00:00:00.000Z`)
      .lte("fecha_hora", `${fechaFin}T23:59:59.999Z`)
      .order("fecha_hora", { ascending: true });

    if (empleadoId && empleadoId !== "todos") {
      query = query.eq("empleado_id", empleadoId);
    }

    const { data: asistenciasRaw, error } = await query;

    if (error || !asistenciasRaw) {
      return {
        success: false,
        jornadas: [],
        resumen: {
          horasOrdinariasTotales: 0,
          horasExtraDoblesTotales: 0,
          horasExtraTriplesTotales: 0,
          totalRetardos: 0,
          diasLaborados: 0,
        },
        error: error?.message || "No se pudieron obtener las asistencias.",
      };
    }

    // Agrupar eventos por: `${empleado_id}_${YYYY-MM-DD}`
    const agrupado = new Map<
      string,
      {
        empleado: {
          id: string;
          numero_empleado: string;
          nombre: string;
          apellidos: string;
          puesto: string;
        };
        fechaStr: string;
        eventos: EventoAsistenciaSimple[];
      }
    >();

    for (const raw of asistenciasRaw as any[]) {
      const emp = raw.empleados;
      if (!emp) continue;

      const fechaDia = raw.fecha_hora.slice(0, 10);
      const key = `${raw.empleado_id}_${fechaDia}`;

      if (!agrupado.has(key)) {
        agrupado.set(key, {
          empleado: {
            id: emp.id,
            numero_empleado: emp.numero_empleado,
            nombre: emp.nombre,
            apellidos: emp.apellidos,
            puesto: emp.puesto,
          },
          fechaStr: fechaDia,
          eventos: [],
        });
      }

      const meta = raw.metadatos_origen as any;
      agrupado.get(key)!.eventos.push({
        tipoEvento: raw.tipo_evento_original,
        fechaHora: raw.fecha_hora,
        metodoRegistro: raw.metodo_registro,
        fotoUrl: meta?.foto_verificacion || null,
        motivoAjuste: meta?.motivo_ajuste || raw.justificacion || null,
      });
    }

    // Procesar jornadas diarias con cálculo LFT
    const jornadasSinConsolidar: JornadaEmpleadoCompleta[] = [];
    agrupado.forEach(({ empleado, fechaStr, eventos }) => {
      const jornadaCalculada = procesarJornadaDiaria(eventos, fechaStr);
      jornadasSinConsolidar.push({
        ...jornadaCalculada,
        empleado,
      });
    });

    // Consolidar horas extras dobles/triples respetando el tope de 9h semanales
    const { jornadasAjustadas, resumen } = consolidarPeriodoLFT(jornadasSinConsolidar);

    // Ordenar de más reciente a más antiguo
    const jornadasFinales = (jornadasAjustadas as JornadaEmpleadoCompleta[]).sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );

    return {
      success: true,
      jornadas: jornadasFinales,
      resumen,
    };
  } catch (err) {
    return {
      success: false,
      jornadas: [],
      resumen: {
        horasOrdinariasTotales: 0,
        horasExtraDoblesTotales: 0,
        horasExtraTriplesTotales: 0,
        totalRetardos: 0,
        diasLaborados: 0,
      },
      error: err instanceof Error ? err.message : "Error al procesar asistencias.",
    };
  }
}

/**
 * Registra un marcaje manual o justificación administrativa.
 * Exige motivo obligatorio para cumplir con el pilar de Trazabilidad LFT.
 */
export async function registrarMarcajeManual(formData: FormData): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sesión no válida o expirada." };
  }

  // Validar rol administrador
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, nombre, apellidos")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "ADMINISTRADOR") {
    return {
      success: false,
      error: "Solo un administrador autorizado puede realizar marcajes manuales.",
    };
  }

  const empleado_id = String(formData.get("empleado_id") || "").trim();
  const fecha = String(formData.get("fecha") || "").trim(); // YYYY-MM-DD
  const hora = String(formData.get("hora") || "").trim(); // HH:mm
  const tipo_evento = String(formData.get("tipo_evento") || "").trim();
  const motivo_ajuste = String(formData.get("motivo_ajuste") || "").trim();

  if (!empleado_id || !fecha || !hora || !tipo_evento) {
    return { success: false, error: "Todos los campos de fecha, hora y tipo de evento son obligatorios." };
  }

  // Trazabilidad LFT: El motivo es estrictamente obligatorio
  if (!motivo_ajuste || motivo_ajuste.length < 5) {
    return {
      success: false,
      error: "La normativa laboral exige ingresar un motivo justificado para cualquier corrección manual (mínimo 5 caracteres).",
    };
  }

  const fechaHoraStr = `${fecha}T${hora}:00.000Z`;
  const adminClient = createAdminClient();

  try {
    // Generar hash de inmutabilidad
    const hashString = `${empleado_id}:${tipo_evento}:${fechaHoraStr}:MANUAL`;
    const hashEvento = crypto.createHash("sha256").update(hashString).digest("hex");

    const metadatos = {
      origen: "ADMINISTRATIVO_MANUAL",
      motivo_ajuste,
      autor_id: user.id,
      autor_nombre: `${perfil.nombre} ${perfil.apellidos}`.trim(),
      fecha_ajuste: new Date().toISOString(),
    };

    const { data: nuevaAsistencia, error: insertError } = await adminClient
      .from("asistencias")
      .insert({
        empleado_id,
        fecha_hora: fechaHoraStr,
        tipo_evento_original: tipo_evento as any,
        metodo_registro: "MANUAL",
        justificacion: motivo_ajuste,
        metadatos_origen: metadatos as unknown as Json,
        hash_evento: hashEvento,
        estado: "REGISTRADA",
      })
      .select("*")
      .single();

    if (insertError) {
      return {
        success: false,
        error: insertError.message || "No se pudo guardar el marcaje manual en la base de datos.",
      };
    }

    // Auditoría estricta
    await adminClient.from("registros_auditoria").insert({
      perfil_id: user.id,
      accion: "AJUSTE_ASISTENCIA_MANUAL",
      tabla_afectada: "asistencias",
      registro_afectado_id: nuevaAsistencia.id,
      valores_previos: null,
      valores_nuevos: {
        empleado_id,
        tipo_evento,
        fecha_hora: fechaHoraStr,
        motivo_ajuste,
        autor: perfil.nombre,
      } as unknown as Json,
    });

    revalidatePath("/asistencias");
    revalidatePath("/reportes");

    return {
      success: true,
      message: "Marcaje manual registrado correctamente con trazabilidad de auditoría.",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado al registrar el marcaje.",
    };
  }
}
