"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database.types";

export type UbicacionExtraordinariaRow = Database["public"]["Tables"]["ubicaciones_extraordinarias"]["Row"];

export interface PermisoConEmpleado extends UbicacionExtraordinariaRow {
  empleado?: {
    id: string;
    nombre: string;
    apellidos: string;
    numero_empleado: string;
    puesto: string;
  } | null;
  diasRestantes?: number;
  estaExpirado?: boolean;
}

export interface PermisoActionResult {
  success: boolean;
  message?: string;
  error?: string;
  permiso?: UbicacionExtraordinariaRow;
}

/**
 * Consulta todas las ubicaciones extraordinarias de viaje registradas,
 * calculando vigencia y filtrando o purgando caducadas.
 */
export async function obtenerPermisosExtraordinarios(
  empleadoId?: string
): Promise<{
  permisos: PermisoConEmpleado[];
  error?: string;
}> {
  const adminClient = createAdminClient();
  const hoyStr = new Date().toISOString().slice(0, 10);

  try {
    let query = adminClient
      .from("ubicaciones_extraordinarias")
      .select("*, empleado:empleados(id, nombre, apellidos, numero_empleado, puesto)")
      .order("activo", { ascending: false })
      .order("fecha_fin", { ascending: true });

    if (empleadoId) {
      query = query.eq("empleado_id", empleadoId);
    }

    const { data, error } = await query;

    if (error) {
      return { permisos: [], error: "No se pudieron consultar los permisos extraordinarios." };
    }

    const hoy = new Date(hoyStr);

    const permisosProcesados: PermisoConEmpleado[] = (data ?? []).map((item: any) => {
      const fechaFin = new Date(item.fecha_fin);
      const diffTiempo = fechaFin.getTime() - hoy.getTime();
      const diasRestantes = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));
      const estaExpirado = diasRestantes < 0 || !item.activo;

      return {
        ...item,
        diasRestantes: Math.max(0, diasRestantes),
        estaExpirado,
      };
    });

    // Purgar o desactivar en segundo plano las ubicaciones caducadas
    const idsCaducados = permisosProcesados
      .filter((p) => p.estaExpirado && p.activo)
      .map((p) => p.id);

    if (idsCaducados.length > 0) {
      await adminClient
        .from("ubicaciones_extraordinarias")
        .update({ activo: false })
        .in("id", idsCaducados);
    }

    return { permisos: permisosProcesados };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al consultar permisos.";
    return { permisos: [], error: msg };
  }
}

/**
 * Da de alta una nueva ubicación autorizada extraordinaria para un empleado en viaje de negocios.
 * Vigencia permitida: de 1 día hasta 14 días (2 semanas).
 */
export async function crearPermisoExtraordinario(
  formData: FormData
): Promise<PermisoActionResult> {
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
      error: "Solo un administrador puede autorizar ubicaciones de viaje.",
    };
  }

  const empleado_id = String(formData.get("empleado_id") || "").trim();
  const motivo = String(formData.get("motivo") || "").trim();
  const nombre_lugar = String(formData.get("nombre_lugar") || "").trim();
  const direccion = String(formData.get("direccion") || "").trim();
  const latitud = parseFloat(String(formData.get("latitud") || ""));
  const longitud = parseFloat(String(formData.get("longitud") || ""));
  const radio_tolerancia_metros = parseInt(String(formData.get("radio_tolerancia_metros") || "200"), 10);
  const fecha_inicio = String(formData.get("fecha_inicio") || new Date().toISOString().slice(0, 10)).trim();
  const fecha_fin = String(formData.get("fecha_fin") || "").trim();

  if (!empleado_id) return { success: false, error: "Selecciona el empleado comisionado." };
  if (!motivo) return { success: false, error: "Indica el motivo del viaje o comisión." };
  if (!nombre_lugar) return { success: false, error: "Indica el nombre del lugar de destino." };
  if (isNaN(latitud) || isNaN(longitud)) {
    return { success: false, error: "Debes seleccionar una ubicación válida en el mapa." };
  }
  if (!fecha_inicio || !fecha_fin) {
    return { success: false, error: "Debes especificar las fechas de inicio y fin de la vigencia." };
  }

  // Validación de vigencia (de 1 día a 14 días máximo)
  const inicioDate = new Date(fecha_inicio);
  const finDate = new Date(fecha_fin);

  if (finDate < inicioDate) {
    return { success: false, error: "La fecha de fin no puede ser anterior a la fecha de inicio." };
  }

  const diffDias = Math.ceil((finDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (diffDias > 14) {
    return {
      success: false,
      error: `La vigencia máxima autorizada es de 14 días (2 semanas). La duración seleccionada es de ${diffDias} días.`,
    };
  }

  try {
    const adminClient = createAdminClient();

    const { data: nuevoPermiso, error } = await adminClient
      .from("ubicaciones_extraordinarias")
      .insert({
        empleado_id,
        motivo,
        nombre_lugar,
        direccion: direccion || null,
        latitud,
        longitud,
        radio_tolerancia_metros: radio_tolerancia_metros || 200,
        fecha_inicio,
        fecha_fin,
        activo: true,
        creado_por: user.id,
      })
      .select("*")
      .single();

    if (error || !nuevoPermiso) {
      return { success: false, error: "No se pudo registrar la ubicación extraordinaria en la base de datos." };
    }

    // Auditoría
    await adminClient.from("registros_auditoria").insert({
      perfil_id: user.id,
      accion: "ALTA_UBICACION_EXTRAORDINARIA",
      tabla_afectada: "ubicaciones_extraordinarias",
      registro_afectado_id: nuevoPermiso.id,
      valores_previos: null,
      valores_nuevos: nuevoPermiso as unknown as Json,
    });

    revalidatePath("/configuracion");
    revalidatePath("/empleados");
    revalidatePath("/checador");

    return {
      success: true,
      message: `Ubicación autorizada para el viaje a "${nombre_lugar}" con vigencia hasta el ${fecha_fin}.`,
      permiso: nuevoPermiso,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de base de datos.";
    return { success: false, error: msg };
  }
}

/**
 * Elimina o revoca anticipadamente una ubicación extraordinaria de viaje.
 */
export async function eliminarPermisoExtraordinario(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Sesión expirada." };

  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("ubicaciones_extraordinarias")
      .delete()
      .eq("id", id);

    if (error) {
      return { success: false, error: "No se pudo revocar la ubicación." };
    }

    revalidatePath("/configuracion");
    revalidatePath("/empleados");
    revalidatePath("/checador");

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al eliminar.";
    return { success: false, error: msg };
  }
}
