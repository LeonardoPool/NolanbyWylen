"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database.types";

export type IncidenciaRow = Database["public"]["Tables"]["incidencias_empleado"]["Row"];

export interface IncidenciaConEmpleado extends IncidenciaRow {
  empleado?: {
    id: string;
    nombre: string;
    apellidos: string;
    numero_empleado: string;
    puesto: string;
  } | null;
  revisor?: {
    nombre: string;
    apellidos: string;
  } | null;
}

async function obtenerIpCliente(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip")?.trim() ||
      "127.0.0.1"
    );
  } catch {
    return "127.0.0.1";
  }
}

/**
 * Consulta la lista de incidencias para el panel administrativo, con filtros.
 */
export async function obtenerIncidenciasAdmin(filtros?: {
  estado?: string;
  tipo?: string;
  empleadoId?: string;
}): Promise<{
  incidencias: IncidenciaConEmpleado[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { incidencias: [], error: "Sesión no válida o expirada." };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, activo")
    .eq("id", user.id)
    .single();

  if (!perfil?.activo || perfil.rol !== "ADMINISTRADOR") {
    return { incidencias: [], error: "Acceso exclusivo para administradores." };
  }

  const adminClient = createAdminClient();

  try {
    let query = adminClient
      .from("incidencias_empleado")
      .select(`
        *,
        empleado:empleados(id, nombre, apellidos, numero_empleado, puesto),
        revisor:perfiles!incidencias_empleado_perfil_revisor_id_fkey(nombre, apellidos)
      `)
      .order("fecha_creacion", { ascending: false });

    if (filtros?.estado && filtros.estado !== "TODOS") {
      query = query.eq("estado", filtros.estado as any);
    }

    if (filtros?.tipo && filtros.tipo !== "TODOS") {
      query = query.eq("tipo", filtros.tipo as any);
    }

    if (filtros?.empleadoId && filtros.empleadoId !== "TODOS") {
      query = query.eq("empleado_id", filtros.empleadoId);
    }

    const { data, error } = await query;

    if (error) {
      // Fallback simple si la relación foreign key con revisor no tiene alias explícito
      const { data: dataFallback, error: errFallback } = await adminClient
        .from("incidencias_empleado")
        .select(`
          *,
          empleado:empleados(id, nombre, apellidos, numero_empleado, puesto)
        `)
        .order("fecha_creacion", { ascending: false });

      if (errFallback) {
        return { incidencias: [], error: "No se pudieron consultar las solicitudes." };
      }
      return { incidencias: (dataFallback as any[]) ?? [] };
    }

    return { incidencias: (data as any[]) ?? [] };
  } catch (err) {
    return {
      incidencias: [],
      error: err instanceof Error ? err.message : "Error al consultar incidencias.",
    };
  }
}

/**
 * Resuelve una solicitud (Aprobar / Rechazar) con auditoría inmutable.
 */
export async function resolverIncidenciaAdmin(params: {
  incidenciaId: string;
  accion: "APROBADA" | "RECHAZADA";
  comentario?: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const { incidenciaId, accion, comentario } = params;

  if (!incidenciaId || !accion) {
    return { success: false, error: "Datos incompletos para resolver la solicitud." };
  }

  if (accion === "RECHAZADA" && (!comentario || comentario.trim().length < 5)) {
    return {
      success: false,
      error: "Para rechazar una solicitud es obligatorio ingresar un motivo justificado (mínimo 5 caracteres).",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sesión no válida o expirada." };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, activo, nombre, apellidos")
    .eq("id", user.id)
    .single();

  if (!perfil?.activo || perfil.rol !== "ADMINISTRADOR") {
    return { success: false, error: "Solo los administradores autorizados pueden resolver incidencias." };
  }

  const adminClient = createAdminClient();

  // Obtener incidencia actual
  const { data: incActual, error: getErr } = await adminClient
    .from("incidencias_empleado")
    .select("*")
    .eq("id", incidenciaId)
    .single();

  if (getErr || !incActual) {
    return { success: false, error: "No se encontró la solicitud especificada." };
  }

  const ahora = new Date().toISOString();
  const comentarioLimpio = comentario?.trim() || null;

  // Actualizar estado de documento si existe
  const nuevoDocEstado = incActual.documento_path
    ? accion === "APROBADA"
      ? "ACEPTADO"
      : "RECHAZADO"
    : incActual.documento_estado;

  const { error: updateErr } = await adminClient
    .from("incidencias_empleado")
    .update({
      estado: accion,
      respuesta_administrador: comentarioLimpio,
      perfil_revisor_id: user.id,
      fecha_resolucion: ahora,
      documento_estado: nuevoDocEstado as any,
      documento_revisado_por: incActual.documento_path ? user.id : null,
      documento_revisado_en: incActual.documento_path ? ahora : null,
      documento_comentario: incActual.documento_path ? comentarioLimpio : null,
    })
    .eq("id", incidenciaId);

  if (updateErr) {
    return { success: false, error: "No se pudo actualizar el estado de la solicitud en la base de datos." };
  }

  // Registrar auditoría estricta
  await adminClient.from("registros_auditoria").insert({
    perfil_id: user.id,
    accion: `RESOLUCION_INCIDENCIA_${accion}`,
    tabla_afectada: "incidencias_empleado",
    registro_afectado_id: incidenciaId,
    valores_previos: {
      estado: incActual.estado,
      documento_estado: incActual.documento_estado,
    } as unknown as Json,
    valores_nuevos: {
      estado: accion,
      comentario: comentarioLimpio,
      documento_estado: nuevoDocEstado,
      revisor: `${perfil.nombre} ${perfil.apellidos}`.trim(),
    } as unknown as Json,
  });

  revalidatePath("/incidencias");
  revalidatePath("/dashboard");
  revalidatePath("/asistencias");

  return {
    success: true,
    message: `Solicitud ${accion === "APROBADA" ? "aprobada" : "rechazada"} correctamente con registro de auditoría.`,
  };
}

/**
 * Genera una URL firmada de 10 minutos (600 segundos) para visualización privada de justificantes médicos.
 */
export async function obtenerUrlFirmadaJustificante(documentoPath: string): Promise<{
  success: boolean;
  signedUrl?: string;
  error?: string;
}> {
  if (!documentoPath) {
    return { success: false, error: "Ruta de documento no especificada." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sesión no válida o expirada." };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, activo")
    .eq("id", user.id)
    .single();

  if (!perfil?.activo || perfil.rol !== "ADMINISTRADOR") {
    return {
      success: false,
      error: "Acceso denegado. Solo administradores autorizados pueden visualizar documentos médicos.",
    };
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.storage
    .from("justificantes-medicos")
    .createSignedUrl(documentoPath, 600); // 10 minutos exactos

  if (error || !data?.signedUrl) {
    return { success: false, error: "No se pudo generar el enlace seguro de visualización." };
  }

  // Trazabilidad de acceso a datos sensibles de salud
  await adminClient.from("registros_auditoria").insert({
    perfil_id: user.id,
    accion: "ACCESO_JUSTIFICANTE_MEDICO",
    tabla_afectada: "justificantes-medicos",
    valores_nuevos: {
      documento_path: documentoPath,
      ip: await obtenerIpCliente(),
      fecha: new Date().toISOString(),
    } as unknown as Json,
  });

  return { success: true, signedUrl: data.signedUrl };
}

/**
 * Consulta de monitoreo del espacio utilizado en el bucket para anticipar límites del plan gratuito.
 */
export async function obtenerMonitoreoBucketJustificantes(): Promise<{
  archivosTotales: number;
  tamanoTotalBytes: number;
  tamanoFormateado: string;
}> {
  const adminClient = createAdminClient();

  try {
    const { data: incidenciasConDoc } = await adminClient
      .from("incidencias_empleado")
      .select("documento_tamano_bytes")
      .not("documento_path", "is", null);

    const totalBytes = (incidenciasConDoc || []).reduce(
      (sum, item) => sum + (item.documento_tamano_bytes || 0),
      0
    );

    const formateado =
      totalBytes < 1024 * 1024
        ? `${(totalBytes / 1024).toFixed(1)} KB`
        : `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;

    return {
      archivosTotales: incidenciasConDoc?.length || 0,
      tamanoTotalBytes: totalBytes,
      tamanoFormateado: `${formateado} (de 1000 MB del plan gratuito)`,
    };
  } catch {
    return {
      archivosTotales: 0,
      tamanoTotalBytes: 0,
      tamanoFormateado: "0 KB",
    };
  }
}
