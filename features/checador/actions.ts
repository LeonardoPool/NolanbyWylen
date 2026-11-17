"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database.types";

export type EmpleadoRow = Database["public"]["Tables"]["empleados"]["Row"];
export type ConfiguracionTallerRow = Database["public"]["Tables"]["configuracion_taller"]["Row"];
export type IncidenciaRow = Database["public"]["Tables"]["incidencias_empleado"]["Row"];
export type AsistenciaRow = Database["public"]["Tables"]["asistencias"]["Row"];
export type UbicacionExtraordinariaRow = Database["public"]["Tables"]["ubicaciones_extraordinarias"]["Row"];

export type TipoEventoChecador =
  | "ENTRADA"
  | "SALIDA"
  | "INICIO_DESCANSO"
  | "FIN_DESCANSO";

/**
 * Fórmula de Haversine para calcular distancia en metros entre dos coordenadas GPS.
 */
export async function calcularDistanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<number> {
  const R = 6371e3; // Radio medio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Obtiene la dirección IP del cliente desde los encabezados de la petición de forma segura.
 */
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
 * Autentica al empleado con su CURP o Correo + PIN de 4 dígitos.
 * Incluye mitigación contra fuerza bruta en base de datos (límite de 5 intentos fallidos en 15 min).
 */
export async function autenticarEmpleado(
  identificador: string,
  pin: string
): Promise<{
  success: boolean;
  error?: string;
  empleado?: EmpleadoRow;
  configuracion?: ConfiguracionTallerRow;
  permisosViaje?: UbicacionExtraordinariaRow[];
}> {
  const idLimpio = identificador.trim();
  const pinLimpio = pin.trim();

  if (!idLimpio || !pinLimpio) {
    return { success: false, error: "Ingresa tu CURP/Correo y tu PIN de 4 dígitos." };
  }

  const adminClient = createAdminClient();
  const ipOrigen = await obtenerIpCliente();
  const idNormalizado = idLimpio.toUpperCase();

  // 1. Mitigación contra fuerza bruta: verificar intentos fallidos en los últimos 15 minutos
  const ventanaMinutos = 15;
  const fechaLimite = new Date(Date.now() - ventanaMinutos * 60 * 1000).toISOString();
  let intentosFallidosPrevios = 0;

  try {
    const { count, error: countError } = await adminClient
      .from("intentos_acceso_pin")
      .select("*", { count: "exact", head: true })
      .or(`identificador.eq.${idNormalizado},ip_origen.eq.${ipOrigen}`)
      .eq("exitoso", false)
      .gte("fecha_intento", fechaLimite);

    if (!countError && typeof count === "number") {
      intentosFallidosPrevios = count;
      if (intentosFallidosPrevios >= 5) {
        return {
          success: false,
          error: "Demasiados intentos fallidos. Tu acceso ha sido bloqueado temporalmente por 15 minutos para proteger tu cuenta.",
        };
      }
    }
  } catch {
    // Tolerante si la migración aún está en proceso de ejecución
  }

  // 2. Función auxiliar interna para registrar intento fallido
  const registrarFallo = async () => {
    try {
      await adminClient.from("intentos_acceso_pin").insert({
        identificador: idNormalizado,
        ip_origen: ipOrigen,
        exitoso: false,
      });
    } catch {
      // Tolerante
    }
  };

  // 3. Verificar configuración del taller
  const { data: config } = await adminClient
    .from("configuracion_taller")
    .select("*")
    .limit(1)
    .maybeSingle();

  const configTaller: ConfiguracionTallerRow = config ?? {
    id: "00000000-0000-0000-0000-000000000001",
    nombre_taller: "Servicio Mecánico López",
    direccion_taller: "Av. Principal del Taller",
    checado_web_habilitado: true,
    latitud: 19.432608,
    longitud: -99.133209,
    radio_tolerancia_metros: 150,
    fecha_actualizacion: new Date().toISOString(),
  };

  if (!configTaller.checado_web_habilitado) {
    return {
      success: false,
      error: "El checado online se encuentra temporalmente deshabilitado por la administración.",
    };
  }

  // 4. Buscar al empleado por CURP o Correo
  const esCorreo = idLimpio.includes("@");
  let query = adminClient.from("empleados").select("*");

  if (esCorreo) {
    query = query.ilike("correo", idLimpio);
  } else {
    query = query.eq("curp", idNormalizado);
  }

  const { data: empleados, error } = await query.limit(1);

  if (error || !empleados || empleados.length === 0) {
    await registrarFallo();
    const restantes = Math.max(0, 5 - intentosFallidosPrevios - 1);
    return {
      success: false,
      error: `No se encontró ningún empleado registrado con ese CURP o correo.${
        restantes <= 2 ? ` (Intentos restantes: ${restantes})` : ""
      }`,
    };
  }

  const emp = empleados[0];

  if (!emp.activo) {
    return {
      success: false,
      error: "Tu cuenta de empleado se encuentra en estatus de baja. Acude con administración.",
    };
  }

  if (!emp.permite_checado_web) {
    return {
      success: false,
      error: "No tienes autorización para checado online. Debes checar en el equipo físico.",
    };
  }

  if (!emp.pin) {
    return {
      success: false,
      error: "Aún no tienes un PIN asignado. Solicita a tu administrador que te configure uno.",
    };
  }

  if (emp.pin !== pinLimpio) {
    await registrarFallo();
    const restantes = Math.max(0, 5 - intentosFallidosPrevios - 1);
    return {
      success: false,
      error: `El PIN de 4 dígitos ingresado es incorrecto.${
        restantes <= 3 ? ` (Intentos restantes: ${restantes})` : ""
      }`,
    };
  }

  // 5. Autenticación exitosa: registrar intento exitoso
  try {
    await adminClient.from("intentos_acceso_pin").insert({
      identificador: idNormalizado,
      ip_origen: ipOrigen,
      exitoso: true,
    });
  } catch {
    // Tolerante
  }

  // 6. Consultar permisos extraordinarios de viaje activos hoy
  const hoyStr = new Date().toISOString().slice(0, 10);
  const { data: permisos } = await adminClient
    .from("ubicaciones_extraordinarias")
    .select("*")
    .eq("empleado_id", emp.id)
    .eq("activo", true)
    .lte("fecha_inicio", hoyStr)
    .gte("fecha_fin", hoyStr);

  return {
    success: true,
    empleado: emp,
    configuracion: configTaller,
    permisosViaje: permisos ?? [],
  };
}

/**
 * Registra un marcaje de asistencia online validando:
 * 1) Geocerca principal del taller
 * 2) O geocercas extraordinarias por viaje vigentes para el empleado
 */
export async function registrarMarcajeOnline(params: {
  empleadoId: string;
  tipoEvento: TipoEventoChecador;
  latitud: number;
  longitud: number;
  fotoBase64?: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  fueraDeRango?: boolean;
  distanciaMetros?: number;
  radioPermitido?: number;
  esViaje?: boolean;
  asistencia?: AsistenciaRow;
}> {
  const { empleadoId, tipoEvento, latitud, longitud, fotoBase64 } = params;

  if (!empleadoId) {
    return { success: false, error: "Identificador de empleado no válido." };
  }

  if (isNaN(latitud) || isNaN(longitud)) {
    return {
      success: false,
      error: "No se recibieron coordenadas GPS válidas. Activa el GPS de tu celular.",
    };
  }

  const adminClient = createAdminClient();

  // 1. Obtener empleado
  const { data: emp, error: empError } = await adminClient
    .from("empleados")
    .select("*")
    .eq("id", empleadoId)
    .single();

  if (empError || !emp || !emp.activo || !emp.permite_checado_web) {
    return {
      success: false,
      error: "Empleado inactivo o no autorizado para checado web.",
    };
  }

  // 2. Obtener configuración del taller
  const { data: config } = await adminClient
    .from("configuracion_taller")
    .select("*")
    .limit(1)
    .maybeSingle();

  const configTaller: ConfiguracionTallerRow = config ?? {
    id: "00000000-0000-0000-0000-000000000001",
    nombre_taller: "Servicio Mecánico López",
    direccion_taller: "Av. Principal del Taller",
    checado_web_habilitado: true,
    latitud: 19.432608,
    longitud: -99.133209,
    radio_tolerancia_metros: 150,
    fecha_actualizacion: new Date().toISOString(),
  };

  if (!configTaller.checado_web_habilitado) {
    return {
      success: false,
      error: "El checado web está desactivado por el administrador.",
    };
  }

  // 3. Evaluar distancia respecto al taller principal
  const distanciaTaller = await calcularDistanciaMetros(
    latitud,
    longitud,
    Number(configTaller.latitud),
    Number(configTaller.longitud)
  );

  const radioTaller = configTaller.radio_tolerancia_metros || 150;
  let esValido = distanciaTaller <= radioTaller;
  let esViaje = false;
  let lugarNombre = configTaller.nombre_taller;
  let distanciaFinal = distanciaTaller;
  let radioFinal = radioTaller;
  let permisoViajeId: string | null = null;

  // 4. Si está fuera del taller principal, evaluar permisos de viaje activos
  if (!esValido) {
    const hoyStr = new Date().toISOString().slice(0, 10);
    const { data: permisosViaje } = await adminClient
      .from("ubicaciones_extraordinarias")
      .select("*")
      .eq("empleado_id", emp.id)
      .eq("activo", true)
      .lte("fecha_inicio", hoyStr)
      .gte("fecha_fin", hoyStr);

    for (const p of permisosViaje || []) {
      const d = await calcularDistanciaMetros(
        latitud,
        longitud,
        Number(p.latitud),
        Number(p.longitud)
      );
      const radioPermiso = p.radio_tolerancia_metros || 200;

      if (d <= radioPermiso) {
        esValido = true;
        esViaje = true;
        lugarNombre = `${p.nombre_lugar} (${p.motivo})`;
        distanciaFinal = d;
        radioFinal = radioPermiso;
        permisoViajeId = p.id;
        break;
      }
    }
  }

  if (!esValido) {
    return {
      success: false,
      fueraDeRango: true,
      distanciaMetros: distanciaTaller,
      radioPermitido: radioTaller,
      error: `Te encuentras a ${distanciaTaller}m del taller y no estás dentro de ninguna ubicación autorizada por viaje de negocios.`,
    };
  }

  // 5. Guardar evento de asistencia con idempotencia
  const ahora = new Date();
  const fechaStr = ahora.toISOString();
  const minutoVentana = fechaStr.slice(0, 16);
  const hashString = `${emp.id}:${tipoEvento}:${minutoVentana}`;
  const hashEvento = crypto.createHash("sha256").update(hashString).digest("hex");

  const metadatos = {
    origen: "WEB_MOVIL",
    es_viaje_extraordinario: esViaje,
    permiso_viaje_id: permisoViajeId,
    lugar_autorizado: lugarNombre,
    latitud,
    longitud,
    distancia_metros: distanciaFinal,
    fecha_cliente: fechaStr,
    foto_verificacion: fotoBase64 || null,
    validacion_identidad: fotoBase64 ? "BIOMETRIA_FOTOGRAFICA" : "PIN_GPS",
  };

  const { data: nuevaAsistencia, error: insertError } = await adminClient
    .from("asistencias")
    .insert({
      empleado_id: emp.id,
      hash_evento: hashEvento,
      fecha_hora: fechaStr,
      tipo_evento_original: tipoEvento,
      metodo_registro: "WEB",
      metadatos_origen: metadatos as unknown as Json,
      estado: "REGISTRADA",
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        success: false,
        error: "Ya registraste este marcaje hace un instante. Espera un momento antes de volver a checar.",
      };
    }
    return {
      success: false,
      error: "Ocurrió un error al guardar tu asistencia en el sistema.",
    };
  }

  const nombresEventos: Record<TipoEventoChecador, string> = {
    ENTRADA: "Hora de Entrada",
    SALIDA: "Hora de Salida",
    INICIO_DESCANSO: "Inicio de Descanso",
    FIN_DESCANSO: "Fin de Descanso",
  };

  return {
    success: true,
    esViaje,
    message: esViaje
      ? `${nombresEventos[tipoEvento]} registrada en sede de viaje: ${lugarNombre} (${distanciaFinal}m).`
      : `${nombresEventos[tipoEvento]} registrada con éxito (${distanciaFinal}m del taller).`,
    asistencia: nuevaAsistencia,
  };
}

/**
 * Consulta los marcajes del día actual para un empleado.
 */
export async function obtenerMarcajesDelDia(
  empleadoId: string
): Promise<AsistenciaRow[]> {
  const adminClient = createAdminClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const { data, error } = await adminClient
    .from("asistencias")
    .select("*")
    .eq("empleado_id", empleadoId)
    .gte("fecha_hora", `${hoy}T00:00:00.000Z`)
    .order("fecha_hora", { ascending: false });

  if (error || !data) return [];
  return data;
}

/**
 * Solicita una incidencia (vacaciones, falta justificada, permiso, incapacidad).
 */
export async function registrarIncidencia(params: {
  empleadoId: string;
  tipo: "FALTA_JUSTIFICADA" | "VACACIONES" | "PERMISO" | "INCAPACIDAD";
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  incidencia?: IncidenciaRow;
}> {
  const { empleadoId, tipo, fechaInicio, fechaFin, motivo } = params;

  if (!empleadoId || !tipo || !fechaInicio || !fechaFin || !motivo.trim()) {
    return { success: false, error: "Todos los campos de la solicitud son obligatorios." };
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("incidencias_empleado")
    .insert({
      empleado_id: empleadoId,
      tipo,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      motivo: motivo.trim(),
      estado: "PENDIENTE",
    })
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, error: "No se pudo registrar la solicitud en el sistema." };
  }

  return {
    success: true,
    message: "Tu solicitud fue enviada a la administración para su revisión.",
    incidencia: data,
  };
}

/**
 * Obtiene el historial de incidencias del empleado.
 */
export async function obtenerIncidenciasEmpleado(
  empleadoId: string
): Promise<IncidenciaRow[]> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("incidencias_empleado")
    .select("*")
    .eq("empleado_id", empleadoId)
    .order("fecha_creacion", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data;
}
