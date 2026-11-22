"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  obtenerFechaHoyMerida,
  obtenerRangoDiaMeridaEnUtc,
  compararFechasCalendario,
  calcularDiasEntreFechas,
} from "@/lib/utils/fechas-laborales";
import {
  IncidenciaFormSchema,
  validarMagicBytesArchivo,
  type TipoIncidencia,
} from "@/lib/validaciones/incidencias.schema";
import {
  compararDescriptoresFaciales,
} from "@/lib/biometria/face-id-engine";
import {
  obtenerBiometriaFacialEmpleado,
  guardarBiometriaFacialEmpleado,
} from "@/features/empleados/actions";
import { obtenerHorarioLaboralConfig } from "@/features/configuracion/actions";
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
  tieneBiometriaFacial?: boolean;
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
    dia_descanso_semanal: 0,
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

  // 6. Consultar permisos extraordinarios de viaje activos hoy en America/Merida
  const hoyStr = obtenerFechaHoyMerida();
  const { data: permisos } = await adminClient
    .from("ubicaciones_extraordinarias")
    .select("*")
    .eq("empleado_id", emp.id)
    .eq("activo", true)
    .lte("fecha_inicio", hoyStr)
    .gte("fecha_fin", hoyStr);

  // 7. Validar si la cuenta ya tiene registrado el modelo biométrico Face ID
  const biometria = await obtenerBiometriaFacialEmpleado(emp.id);

  return {
    success: true,
    empleado: emp,
    configuracion: configTaller,
    permisosViaje: permisos ?? [],
    tieneBiometriaFacial: Boolean(biometria.enrolado),
  };
}

/**
 * Enrola por primera vez el modelo de reconocimiento facial Face ID de un empleado existente.
 */
export async function enrolarFaceIdInicial(params: {
  empleadoId: string;
  descriptor: number[];
  fotoBase64: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const { empleadoId, descriptor, fotoBase64 } = params;

  if (!empleadoId) {
    return { success: false, error: "Identificador de empleado no válido." };
  }

  if (!descriptor || descriptor.length !== 128) {
    return {
      success: false,
      error: "No se pudo extraer el vector biométrico facial de 128 dimensiones. Asegúrate de enfocar bien tu rostro con buena luz.",
    };
  }

  if (!fotoBase64) {
    return {
      success: false,
      error: "No se recibió la captura fotográfica del rostro.",
    };
  }

  const res = await guardarBiometriaFacialEmpleado({
    empleadoId,
    descriptor,
    fotoThumbnail: fotoBase64,
  });

  if (!res.success) {
    return { success: false, error: res.error || "Error al almacenar el modelo biométrico." };
  }

  return {
    success: true,
    message: "¡Modelo Face ID registrado exitosamente! A partir de ahora tus asistencias se verificarán contra tu rostro.",
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
  descriptorEnVivo?: number[];
  pruebaDeVidaExitosa?: boolean;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  fueraDeRango?: boolean;
  distanciaMetros?: number;
  radioPermitido?: number;
  esViaje?: boolean;
  asistencia?: AsistenciaRow;
  fraudeFacial?: boolean;
  similitudFacial?: number;
}> {
  const {
    empleadoId,
    tipoEvento,
    latitud,
    longitud,
    fotoBase64,
    descriptorEnVivo,
    pruebaDeVidaExitosa,
  } = params;

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
    dia_descanso_semanal: 0,
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
    const hoyStr = obtenerFechaHoyMerida();
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

  // 5. Verificación Biométrica Facial Face ID (Anti-Fraude y Anti-Suplantación)
  let validacionIdentidad = fotoBase64 ? "BIOMETRIA_FOTOGRAFICA" : "PIN_GPS";
  let similitudFacialRegistrada: number | null = null;
  let distanciaEuclidianaRegistrada: number | null = null;

  try {
    const biometria = await obtenerBiometriaFacialEmpleado(emp.id);

    if (biometria.enrolado && biometria.descriptor && biometria.descriptor.length === 128) {
      // El empleado tiene biometría facial enrolada obligatoria
      if (!descriptorEnVivo || descriptorEnVivo.length !== 128) {
        return {
          success: false,
          fraudeFacial: true,
          error: `Verificación Face ID requerida: El trabajador ${emp.nombre} ${emp.apellidos} tiene enrolamiento biométrico facial obligatorio. Enciende tu cámara para validar tu rostro.`,
        };
      }

      const comparacion = compararDescriptoresFaciales(biometria.descriptor, descriptorEnVivo);
      similitudFacialRegistrada = Math.round(comparacion.porcentajeSimilitud);
      distanciaEuclidianaRegistrada = Number(comparacion.distanciaEuclidiana.toFixed(4));

      if (!comparacion.coincide) {
        return {
          success: false,
          fraudeFacial: true,
          similitudFacial: similitudFacialRegistrada,
          error: `Alerta Anti-Fraude: El rostro capturado no coincide con el Face ID registrado de ${emp.nombre} (Similitud: ${similitudFacialRegistrada}%, requerido mínimo 82%). Marcaje rechazado por seguridad.`,
        };
      }

      validacionIdentidad = "FACE_ID_BIOMETRICO_VERIFICADO";
    } else if (descriptorEnVivo && descriptorEnVivo.length === 128 && fotoBase64) {
      // Si el empleado aún no estaba enrolado y presenta una muestra facial válida, auto-enrolar baseline
      await guardarBiometriaFacialEmpleado({
        empleadoId: emp.id,
        descriptor: descriptorEnVivo,
        fotoThumbnail: fotoBase64,
      });
      validacionIdentidad = "FACE_ID_PRIMER_ENROLAMIENTO";
    }
  } catch (errBiom) {
    console.error("Aviso en validación Face ID:", errBiom);
  }

  // 6. Guardar evento de asistencia con idempotencia
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
    validacion_identidad: validacionIdentidad,
    similitud_facial: similitudFacialRegistrada,
    distancia_euclidiana: distanciaEuclidianaRegistrada,
    prueba_de_vida: pruebaDeVidaExitosa ?? Boolean(fotoBase64),
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
 * Consulta los marcajes del día actual para un empleado en America/Merida.
 */
export async function obtenerMarcajesDelDia(
  empleadoId: string
): Promise<AsistenciaRow[]> {
  const adminClient = createAdminClient();
  const { inicioUtc, finUtc } = obtenerRangoDiaMeridaEnUtc();

  const { data, error } = await adminClient
    .from("asistencias")
    .select("*")
    .eq("empleado_id", empleadoId)
    .gte("fecha_hora", inicioUtc)
    .lte("fecha_hora", finUtc)
    .order("fecha_hora", { ascending: false });

  if (error || !data) return [];
  return data;
}

/**
 * Solicita una incidencia (vacaciones, falta justificada, permiso, incapacidad).
 * Aplica validaciones estrictas de zona horaria (America/Merida), bloqueo de fechas pasadas,
 * soporte de retroactividad justificada para incapacidades médicas del IMSS (hasta 30 días)
 * y almacenamiento seguro inmutable de comprobantes en Supabase Storage sin OCR/IA externa.
 */
export async function registrarIncidencia(params: {
  empleadoId: string;
  tipo: TipoIncidencia;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
  archivoBase64?: string;
  archivoNombre?: string;
  consentimientoSalud?: boolean;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  incidencia?: IncidenciaRow;
}> {
  // 1. Validación de esquema con Zod
  const validacion = IncidenciaFormSchema.safeParse({
    empleadoId: params.empleadoId,
    tipo: params.tipo,
    fechaInicio: params.fechaInicio,
    fechaFin: params.fechaFin,
    motivo: params.motivo,
    consentimientoSalud: params.consentimientoSalud,
  });

  if (!validacion.success) {
    const errorMsg = validacion.error.issues[0]?.message || "Datos de solicitud inválidos.";
    return { success: false, error: errorMsg };
  }

  const adminClient = createAdminClient();
  const hoyMerida = obtenerFechaHoyMerida();
  const esExtemporanea = compararFechasCalendario(params.fechaInicio, hoyMerida) < 0;

  // 2. Reglas específicas para justificantes de salud
  if (params.tipo === "INCAPACIDAD") {
    if (!params.archivoBase64) {
      return {
        success: false,
        error: "Para solicitar incapacidad médica del IMSS es obligatorio adjuntar el documento justificante (JPG, PNG o PDF).",
      };
    }
    if (!params.consentimientoSalud) {
      return {
        success: false,
        error: "Debes autorizar el consentimiento para el tratamiento confidencial de tu documento de salud.",
      };
    }
  }

  // 3. Procesamiento y subida segura del justificante a Storage privado
  let documentoPath: string | null = null;
  let documentoNombreOriginal: string | null = null;
  let documentoHash: string | null = null;
  let documentoBytes: number | null = null;
  let documentoMime: string | null = null;
  let documentoEstado: "SIN_DOCUMENTO" | "PENDIENTE_REVISION" = "SIN_DOCUMENTO";

  if (params.archivoBase64) {
    const base64Limpio = params.archivoBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Limpio, "base64");
    documentoBytes = buffer.length;

    // Validación de tamaño máximo (5 MB)
    if (documentoBytes > 5 * 1024 * 1024) {
      return {
        success: false,
        error: "El archivo adjunto excede el tamaño máximo permitido de 5 MB.",
      };
    }

    // Validación rigurosa de magic bytes
    const checkMagic = validarMagicBytesArchivo(buffer);
    if (!checkMagic.valido || !checkMagic.mimeDetectado || !checkMagic.extensionSugerida) {
      return {
        success: false,
        error: checkMagic.error || "Formato de archivo no admitido.",
      };
    }

    documentoMime = checkMagic.mimeDetectado;
    documentoNombreOriginal = params.archivoNombre?.slice(0, 150) || `justificante.${checkMagic.extensionSugerida}`;
    documentoHash = crypto.createHash("sha256").update(buffer).digest("hex");
    documentoPath = `${params.empleadoId}/${crypto.randomUUID()}.${checkMagic.extensionSugerida}`;
    documentoEstado = "PENDIENTE_REVISION";

    const { error: uploadError } = await adminClient.storage
      .from("justificantes-medicos")
      .upload(documentoPath, buffer, {
        contentType: checkMagic.mimeDetectado,
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: "No se pudo almacenar el documento médico de forma segura. Intenta de nuevo.",
      };
    }
  }

  // 4. Cálculo de días solicitados efectivos (Art. 74 y descanso semanal)
  let diasEfectivos = calcularDiasEntreFechas(params.fechaInicio, params.fechaFin);
  if (params.tipo === "VACACIONES") {
    try {
      const { data: diasHabiles, error: rpcErr } = await adminClient.rpc("dias_habiles_vacaciones", {
        fecha_inicio: params.fechaInicio,
        fecha_fin: params.fechaFin,
      });
      if (!rpcErr && typeof diasHabiles === "number") {
        diasEfectivos = diasHabiles;
      }
    } catch {
      // tolerante si la función de vacaciones aún no está compilada
    }
  }

  // 5. Inserción protegida en la base de datos
  const ahora = new Date().toISOString();
  const { data, error } = await adminClient
    .from("incidencias_empleado")
    .insert({
      empleado_id: params.empleadoId,
      tipo: params.tipo,
      fecha_inicio: params.fechaInicio,
      fecha_fin: params.fechaFin,
      motivo: params.motivo.trim(),
      estado: "PENDIENTE",
      extemporanea: esExtemporanea,
      dias_solicitados_efectivos: diasEfectivos,
      documento_path: documentoPath,
      documento_nombre_original: documentoNombreOriginal,
      documento_hash_sha256: documentoHash,
      documento_tamano_bytes: documentoBytes,
      documento_mime: documentoMime,
      documento_estado: documentoEstado,
      consentimiento_salud_aceptado: Boolean(params.consentimientoSalud),
      consentimiento_salud_fecha: params.consentimientoSalud ? ahora : null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, error: "No se pudo registrar la solicitud en el sistema." };
  }

  return {
    success: true,
    message: esExtemporanea
      ? "Tu solicitud de incapacidad retroactiva fue registrada con éxito y enviada a revisión administrativa."
      : "Tu solicitud fue enviada a la administración para su revisión.",
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

export interface FaltaDetectada {
  fecha: string; // YYYY-MM-DD
  fechaFormateada: string;
  diaSemana: string;
  turno: string;
  motivoSugerido: string;
}

/**
 * Detecta inasistencias injustificadas del empleado en los últimos 30 días laborales
 * tomando en cuenta el horario laboral oficial, días de descanso y festivos.
 */
export async function obtenerFaltasDetectadasEmpleado(
  empleadoId: string
): Promise<FaltaDetectada[]> {
  try {
    if (!empleadoId) return [];

    const adminClient = createAdminClient();
    const hoyMerida = obtenerFechaHoyMerida();
    const horario = await obtenerHorarioLaboralConfig();

    // Rango de análisis: últimos 30 días naturales
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    const hace30DiasStr = obtenerFechaHoyMerida(hace30Dias);

    // 1. Días festivos oficiales en ese periodo
    const { data: festivos } = await adminClient
      .from("dias_festivos_oficiales")
      .select("fecha")
      .gte("fecha", hace30DiasStr)
      .lte("fecha", hoyMerida);

    const festivosSet = new Set((festivos || []).map((f) => f.fecha));

    // 2. Marcajes de asistencia del empleado en los últimos 30 días
    const fechaInicioIso = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const { data: asistencias } = await adminClient
      .from("asistencias")
      .select("fecha_hora")
      .eq("empleado_id", empleadoId)
      .gte("fecha_hora", fechaInicioIso);

    const diasConAsistencia = new Set<string>();
    if (asistencias) {
      for (const a of asistencias) {
        diasConAsistencia.add(obtenerFechaHoyMerida(a.fecha_hora));
      }
    }

    // 3. Incidencias registradas (aprobadas o pendientes) en los últimos 30 días
    const { data: incidencias } = await adminClient
      .from("incidencias_empleado")
      .select("fecha_inicio, fecha_fin, estado")
      .eq("empleado_id", empleadoId)
      .in("estado", ["APROBADA", "PENDIENTE"]);

    const diasConIncidencia = new Set<string>();
    if (incidencias) {
      for (const inc of incidencias) {
        // Expandir rango de fechas
        let actual = new Date(inc.fecha_inicio + "T12:00:00Z");
        const fin = new Date(inc.fecha_fin + "T12:00:00Z");
        while (actual <= fin) {
          diasConIncidencia.add(actual.toISOString().slice(0, 10));
          actual.setDate(actual.getDate() + 1);
        }
      }
    }

    // 4. Evaluar día por día hacia atrás desde ayer
    const faltasDetectadas: FaltaDetectada[] = [];
    const DIAS_NOMBRES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    for (let offset = 1; offset <= 30; offset++) {
      const fechaCursor = new Date();
      fechaCursor.setDate(fechaCursor.getDate() - offset);
      const fechaStr = obtenerFechaHoyMerida(fechaCursor);

      // Si es festivo oficial, no es falta
      if (festivosSet.has(fechaStr)) continue;

      // Obtener día de la semana
      const diaSemanaNum = fechaCursor.getDay(); // 0 = Domingo, 6 = Sábado

      // Días de descanso configurados
      const diasDescanso = horario.finDeSemana.diasDescanso || [horario.finDeSemana.diaDescansoSemanal];
      if (diasDescanso.includes(diaSemanaNum)) continue;

      let esLaborable = false;
      let turno = "";

      if ((horario.semanal.dias || []).includes(diaSemanaNum)) {
        esLaborable = true;
        turno = `${horario.semanal.horaEntrada} a ${horario.semanal.horaSalida}`;
      } else if ((horario.finDeSemana.dias || []).includes(diaSemanaNum)) {
        esLaborable = true;
        turno = `${horario.finDeSemana.horaEntradaSabado} a ${horario.finDeSemana.horaSalidaSabado}`;
      }

      if (!esLaborable) continue;

      // Si ya tiene asistencia registrada, no es falta
      if (diasConAsistencia.has(fechaStr)) continue;

      // Si ya tiene justificación o vacaciones en trámite/aprobadas, no es falta
      if (diasConIncidencia.has(fechaStr)) continue;

      // Formato legible en español
      const diaNombre = DIAS_NOMBRES[diaSemanaNum];
      const fechaFormateada = fechaCursor.toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "America/Merida",
      });

      faltasDetectadas.push({
        fecha: fechaStr,
        fechaFormateada: fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1),
        diaSemana: diaNombre,
        turno,
        motivoSugerido: `Justificación de inasistencia del ${diaNombre} ${fechaStr}`,
      });
    }

    return faltasDetectadas;
  } catch (err) {
    console.error("[Checador] Error al detectar faltas del empleado:", err);
    return [];
  }
}
