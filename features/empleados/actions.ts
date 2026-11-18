"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { empleadoSchema } from "@/lib/validaciones/empleados.schema";
import type { Database, Json } from "@/types/database.types";

export type EmpleadoRow = Database["public"]["Tables"]["empleados"]["Row"];
export type RolUsuario = Database["public"]["Tables"]["perfiles"]["Row"]["rol"];

export interface EmpleadoActionResult {
  success: boolean;
  message?: string;
  error?: string;
  empleado?: EmpleadoRow;
}

interface AdminAuthCheck {
  ok: true;
  userId: string;
}

interface AdminAuthError {
  ok: false;
  error: string;
}

/**
 * Verifica en el servidor que la sesión pertenezca a un usuario activo con rol ADMINISTRADOR.
 */
async function verificarAdministrador(): Promise<AdminAuthCheck | AdminAuthError> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Sesión no válida o expirada. Inicia sesión nuevamente." };
  }

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("rol, activo")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil || !perfil.activo) {
    return { ok: false, error: "Tu perfil de usuario no se encuentra activo." };
  }

  if (perfil.rol !== "ADMINISTRADOR") {
    return {
      ok: false,
      error: "No tienes permisos de administrador para modificar el catálogo de empleados.",
    };
  }

  return { ok: true, userId: user.id };
}

/**
 * Registra una operación administrativa en la bitácora inmutable usando Service Role en servidor.
 */
async function registrarAuditoria(params: {
  perfilId: string;
  accion: "ALTA_EMPLEADO" | "EDICION_EMPLEADO" | "BAJA_EMPLEADO" | "REACTIVACION_EMPLEADO";
  registroId: string;
  valoresPrevios: Json | null;
  valoresNuevos: Json | null;
}) {
  try {
    const adminClient = createAdminClient();
    await adminClient.from("registros_auditoria").insert({
      perfil_id: params.perfilId,
      accion: params.accion,
      tabla_afectada: "empleados",
      registro_afectado_id: params.registroId,
      valores_previos: params.valoresPrevios,
      valores_nuevos: params.valoresNuevos,
    });
  } catch (err) {
    // No interrumpimos la operación principal si falla la bitácora, pero dejamos traza en servidor.
    console.error("[Auditoría Empleados] Error al registrar evento:", err);
  }
}

/**
 * Traduce errores de PostgreSQL / Supabase a mensajes claros para el usuario.
 */
function mapearErrorPostgres(error: { code?: string; message?: string }): string {
  if (error.code === "23505") {
    const msg = error.message ?? "";
    if (msg.includes("numero_empleado")) {
      return "Ya existe un empleado registrado con ese número de empleado.";
    }
    if (msg.includes("codigo_biometrico")) {
      return "Ese código biométrico ya está asignado a otro empleado.";
    }
    if (msg.includes("curp")) {
      return "Ya existe un empleado registrado con esa misma CURP.";
    }
    if (msg.includes("rfc")) {
      return "Ya existe un empleado registrado con ese mismo RFC.";
    }
    if (msg.includes("correo")) {
      return "Ese correo electrónico ya pertenece a otro trabajador.";
    }
    return "Ya existe un registro con datos de identificación duplicados (número de empleado, checador, CURP, RFC o correo).";
  }

  if (error.code === "42501") {
    return "Permisos insuficientes para realizar esta operación.";
  }

  return "Ocurrió un error al guardar los datos del empleado. Intenta de nuevo.";
}

/**
 * Obtiene el catálogo completo de empleados y el rol del usuario autenticado.
 */
export async function obtenerCatalogoEmpleados(): Promise<{
  empleados: EmpleadoRow[];
  rol: RolUsuario;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let rol: RolUsuario = "SUPERVISOR";

  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (perfil?.rol) {
      rol = perfil.rol;
    }
  }

  const { data, error } = await supabase
    .from("empleados")
    .select("*")
    .order("activo", { ascending: false })
    .order("nombre", { ascending: true })
    .order("apellidos", { ascending: true });

  if (error) {
    return {
      empleados: [],
      rol,
      error: "No se pudo cargar el catálogo de empleados.",
    };
  }

  return {
    empleados: data ?? [],
    rol,
  };
}

/**
 * Crea un nuevo empleado en el catálogo.
 */
export async function crearEmpleado(formData: FormData): Promise<EmpleadoActionResult> {
  const authCheck = await verificarAdministrador();
  if (!authCheck.ok) {
    return { success: false, error: authCheck.error };
  }

  const rawData = {
    numero_empleado: formData.get("numero_empleado"),
    codigo_biometrico: formData.get("codigo_biometrico"),
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    puesto: formData.get("puesto"),
    telefono: formData.get("telefono") ?? undefined,
    nss: formData.get("nss") || undefined,
    rfc: formData.get("rfc") || undefined,
    curp: formData.get("curp") || undefined,
    correo: formData.get("correo") || undefined,
    pin: formData.get("pin") || undefined,
    permite_checado_web: formData.get("permite_checado_web") !== "false",
    fecha_ingreso: formData.get("fecha_ingreso") || undefined,
    dias_vacaciones_tomados_previos: formData.get("dias_vacaciones_tomados_previos") || undefined,
  };

  const validation = empleadoSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Verifica los campos del formulario.",
    };
  }

  const supabase = await createClient();
  const payload = validation.data;

  const { data: nuevoEmpleado, error } = await supabase
    .from("empleados")
    .insert({
      numero_empleado: payload.numero_empleado,
      codigo_biometrico: payload.codigo_biometrico,
      nombre: payload.nombre,
      apellidos: payload.apellidos,
      puesto: payload.puesto,
      telefono: payload.telefono,
      nss: payload.nss,
      rfc: payload.rfc,
      curp: payload.curp,
      correo: payload.correo,
      pin: payload.pin,
      permite_checado_web: payload.permite_checado_web,
      ...(payload.fecha_ingreso ? { fecha_ingreso: payload.fecha_ingreso } : {}),
    })
    .select("*")
    .single();

  if (error || !nuevoEmpleado) {
    return {
      success: false,
      error: error ? mapearErrorPostgres(error) : "No se pudo registrar el empleado.",
    };
  }

  // Si se indicaron días de vacaciones ya tomados previamente a su alta en NOLAN,
  // registrar el ajuste inicial negativo en la bitácora de vacaciones (LFT)
  const diasTomados = payload.dias_vacaciones_tomados_previos;
  if (diasTomados && diasTomados > 0 && nuevoEmpleado.fecha_ingreso) {
    try {
      const adminClient = createAdminClient();
      await adminClient.from("ajustes_vacaciones").insert({
        empleado_id: nuevoEmpleado.id,
        tipo: "AJUSTE_NEGATIVO",
        dias: Math.round(diasTomados),
        motivo: `Carga inicial de saldo: El colaborador ya disfrutó ${diasTomados} día(s) de vacaciones de sus periodos anteriores previos al alta en NOLAN.`,
        autor_perfil_id: authCheck.userId,
      });
      revalidatePath("/vacaciones");
    } catch (errVac) {
      console.error("[Carga Inicial Vacaciones] Error al registrar ajuste de vacaciones:", errVac);
    }
  }

  await registrarAuditoria({
    perfilId: authCheck.userId,
    accion: "ALTA_EMPLEADO",
    registroId: nuevoEmpleado.id,
    valoresPrevios: null,
    valoresNuevos: nuevoEmpleado as unknown as Json,
  });

  revalidatePath("/empleados");
  revalidatePath("/dashboard");
  revalidatePath("/vacaciones");

  return {
    success: true,
    message: `${nuevoEmpleado.nombre} ${nuevoEmpleado.apellidos} fue registrado correctamente.`,
    empleado: nuevoEmpleado,
  };
}

/**
 * Actualiza los datos de un empleado existente.
 */
export async function actualizarEmpleado(
  id: string,
  formData: FormData
): Promise<EmpleadoActionResult> {
  if (!id) {
    return { success: false, error: "Identificador de empleado inválido." };
  }

  const authCheck = await verificarAdministrador();
  if (!authCheck.ok) {
    return { success: false, error: authCheck.error };
  }

  const rawData = {
    numero_empleado: formData.get("numero_empleado"),
    codigo_biometrico: formData.get("codigo_biometrico"),
    nombre: formData.get("nombre"),
    apellidos: formData.get("apellidos"),
    puesto: formData.get("puesto"),
    telefono: formData.get("telefono") ?? undefined,
    nss: formData.get("nss") || undefined,
    rfc: formData.get("rfc") || undefined,
    curp: formData.get("curp") || undefined,
    correo: formData.get("correo") || undefined,
    pin: formData.get("pin") || undefined,
    permite_checado_web: formData.get("permite_checado_web") !== "false",
    fecha_ingreso: formData.get("fecha_ingreso") || undefined,
    dias_vacaciones_tomados_previos: formData.get("dias_vacaciones_tomados_previos") || undefined,
  };

  const validation = empleadoSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Verifica los campos del formulario.",
    };
  }

  const supabase = await createClient();

  const { data: previo } = await supabase
    .from("empleados")
    .select("*")
    .eq("id", id)
    .single();

  if (!previo) {
    return { success: false, error: "El empleado solicitado no existe." };
  }

  const payload = validation.data;

  const { data: actualizado, error } = await supabase
    .from("empleados")
    .update({
      numero_empleado: payload.numero_empleado,
      codigo_biometrico: payload.codigo_biometrico,
      nombre: payload.nombre,
      apellidos: payload.apellidos,
      puesto: payload.puesto,
      telefono: payload.telefono,
      nss: payload.nss,
      rfc: payload.rfc,
      curp: payload.curp,
      correo: payload.correo,
      pin: payload.pin,
      permite_checado_web: payload.permite_checado_web,
      ...(payload.fecha_ingreso ? { fecha_ingreso: payload.fecha_ingreso } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !actualizado) {
    return {
      success: false,
      error: error ? mapearErrorPostgres(error) : "No se pudieron guardar los cambios.",
    };
  }

  await registrarAuditoria({
    perfilId: authCheck.userId,
    accion: "EDICION_EMPLEADO",
    registroId: actualizado.id,
    valoresPrevios: previo as unknown as Json,
    valoresNuevos: actualizado as unknown as Json,
  });

  revalidatePath("/empleados");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: `Se actualizaron los datos de ${actualizado.nombre} ${actualizado.apellidos}.`,
    empleado: actualizado,
  };
}

/**
 * Realiza la baja lógica (activo = false) o reactivación (activo = true) de un empleado.
 */
export async function cambiarEstadoEmpleado(
  id: string,
  nuevoEstado: boolean
): Promise<EmpleadoActionResult> {
  if (!id) {
    return { success: false, error: "Identificador de empleado inválido." };
  }

  const authCheck = await verificarAdministrador();
  if (!authCheck.ok) {
    return { success: false, error: authCheck.error };
  }

  const supabase = await createClient();

  const { data: previo } = await supabase
    .from("empleados")
    .select("*")
    .eq("id", id)
    .single();

  if (!previo) {
    return { success: false, error: "El empleado solicitado no existe." };
  }

  const { data: actualizado, error } = await supabase
    .from("empleados")
    .update({ activo: nuevoEstado })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !actualizado) {
    return {
      success: false,
      error: error ? mapearErrorPostgres(error) : "No se pudo cambiar el estado del empleado.",
    };
  }

  await registrarAuditoria({
    perfilId: authCheck.userId,
    accion: nuevoEstado ? "REACTIVACION_EMPLEADO" : "BAJA_EMPLEADO",
    registroId: actualizado.id,
    valoresPrevios: { activo: previo.activo },
    valoresNuevos: { activo: actualizado.activo },
  });

  revalidatePath("/empleados");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: nuevoEstado
      ? `${actualizado.nombre} ${actualizado.apellidos} fue reactivado.`
      : `${actualizado.nombre} ${actualizado.apellidos} fue dado de baja.`,
    empleado: actualizado,
  };
}
